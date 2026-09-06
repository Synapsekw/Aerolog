create or replace function public.aerolog_command(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p public.aerolog_profiles; o public.aerolog_records; a public.aerolog_records; b public.aerolog_records;
 doc jsonb; k text; rid text; status text; old_status text; note text; event text;
 rules jsonb; count_rows integer; expected integer; newrev integer; choice text;
begin
 select * into p from public.aerolog_profiles where id=auth.uid() and active;
 if p.id is null then raise exception 'Active workspace membership required' using errcode='42501'; end if;
 select settings into rules from public.aerolog_organizations where id=p.organization_id;
 -- Serialize related mutations per organization, preventing assignment and maintenance races.
 perform pg_advisory_xact_lock(hashtextextended(p.organization_id::text,0));
 if command='notification_read' then
  update public.aerolog_notifications set read_by=array_append(read_by,p.id)
   where organization_id=p.organization_id and id=(payload->>'id')::uuid and (recipient_id is null or recipient_id=p.id) and not(p.id=any(read_by));
  return '{"ok":true}'::jsonb;
 end if;
 if command='settings' then
  if p.role<>'admin' then raise exception 'Administrator role required' using errcode='42501'; end if;
  if (payload->>'batteryMinHealth')::numeric not between 0 and 100 or (payload->>'batteryMaxTemperature')::numeric not between 20 and 100 or jsonb_typeof(payload->'allowSelfApproval')<>'boolean' or not exists(select 1 from pg_timezone_names where name=payload->>'timezone') then raise exception 'Invalid workspace policy';end if;
  update public.aerolog_organizations set settings=settings || payload where id=p.organization_id;
  insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)
   values(p.organization_id,p.id,p.display_name,command,'organization',p.organization_id::text,payload);
  return '{"ok":true}'::jsonb;
 end if;
 k:=payload->>'kind';doc:=payload->'data';rid:=doc->>'id';expected:=coalesce((payload->>'revision')::integer,0);
 if k not in ('mission','asset','battery','crew','flight','service') or rid is null then raise exception 'Invalid record';end if;
 if (command='review' or command='mission_complete') and k<>'mission' or command='battery_cycle' and k<>'battery' or command='service_complete' and k<>'service' or command='flight_import' and k<>'flight' then raise exception 'Invalid command for record';end if;
 select * into o from public.aerolog_records where organization_id=p.organization_id and kind=k and id=rid for update;
 if (o.id is null and expected<>0) or (o.id is not null and o.revision<>expected) then raise exception 'This record changed. Refresh and try again.' using errcode='40001';end if;
 if p.role='observer' then raise exception 'Observer access is read only' using errcode='42501';end if;
 if k in ('asset','battery','service') and p.role not in ('admin','manager','technician') then raise exception 'Fleet management permission required' using errcode='42501';end if;
 if k='crew' and p.role not in ('admin','manager') then raise exception 'Crew management permission required' using errcode='42501';end if;
 if k='mission' and p.role not in ('admin','manager','pilot') then raise exception 'Mission planning permission required' using errcode='42501';end if;
 if k='mission' then
  status:=doc->>'status';old_status:=o.data->>'status';
  if p.role='pilot' and o.id is not null and o.created_by<>p.id and o.data->>'pilot'<>p.display_name then raise exception 'You may edit only your own missions' using errcode='42501';end if;
  if command='review' then
   if p.role not in ('admin','manager') then raise exception 'Operations manager approval required' using errcode='42501';end if;
   if old_status<>'Pending approval' or status not in ('Approved','Changes requested') then raise exception 'Only submitted missions may be reviewed';end if;
   if not coalesce((rules->>'allowSelfApproval')::boolean,false) and (o.created_by=p.id or o.data->>'pilot'=p.display_name) then raise exception 'A different operations manager must review this mission';end if;
   note:=trim(coalesce(payload->>'note',''));
   if status='Changes requested' and note='' then raise exception 'A review note is required';end if;
   doc:=o.data || jsonb_build_object('status',status,'reviewNote',note,'reviewedBy',p.display_name,'reviewedAt',now());
  elsif command='mission_complete' then
   if old_status<>'Approved' then raise exception 'Only approved missions can be completed';end if;
   if trim(coalesce(payload->>'note',''))='' then raise exception 'Debrief required';end if;
   doc:=o.data || jsonb_build_object('status','Completed','debrief',payload->>'note','completedAt',now());status:='Completed';
  else
   if command<>'save' or (o.id is not null and old_status not in ('Draft','Changes requested')) or status not in ('Draft','Pending approval') then raise exception 'Mission is locked. Create a revision before editing';end if;
   if status='Pending approval' then
    if trim(coalesce(doc->>'name',''))='' or trim(coalesce(doc->>'location',''))='' then raise exception 'Mission name and location required';end if;
    if doc->>'pilot'=doc->>'observer' then raise exception 'Pilot and observer must be different';end if;
    if (doc->>'date')::date<(now() at time zone coalesce(rules->>'timezone','UTC'))::date then raise exception 'Cannot submit a mission scheduled in the past';end if;
    if jsonb_array_length(coalesce(doc->'risks','[]'))=0 then raise exception 'Risk assessment required';end if;
    if exists(select 1 from jsonb_array_elements(doc->'risks') r where not coalesce((r->>'controlled')::boolean,false) or trim(coalesce(r->>'mitigation',''))='' or trim(coalesce(r->>'hazard',''))='') then raise exception 'Review every hazard and mitigation';end if;
    select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=doc->>'aircraft';
    if a.id is null or a.data->>'category'<>'Aircraft' or a.data->>'status' not in ('Available','Checked out') or (a.data->>'hours')::numeric>=(a.data->>'next')::numeric then raise exception 'Aircraft is unavailable or requires maintenance';end if;
    foreach choice in array array[doc->>'pilot',doc->>'observer'] loop
     select count(*) into count_rows from public.aerolog_records where organization_id=p.organization_id and kind='crew' and data->>'name'=choice and data->>'status'='Available' and (data->>'expires')::date>=(doc->>'date')::date;
     if count_rows=0 then raise exception 'Crew certification or availability must be updated';end if;
    end loop;
    if exists(select 1 from public.aerolog_records x where x.organization_id=p.organization_id and x.kind='mission' and x.id<>rid and x.data->>'status' in ('Pending approval','Approved') and ((x.data->>'date')::date+(x.data->>'time')::time) < ((doc->>'date')::date+(doc->>'time')::time+make_interval(mins=>(doc->>'durationMinutes')::int)) and ((doc->>'date')::date+(doc->>'time')::time) < ((x.data->>'date')::date+(x.data->>'time')::time+make_interval(mins=>(x.data->>'durationMinutes')::int)) and (x.data->>'aircraft'=doc->>'aircraft' or x.data->>'pilot' in (doc->>'pilot',doc->>'observer') or x.data->>'observer' in (doc->>'pilot',doc->>'observer'))) then raise exception 'Crew or aircraft is already assigned in this time window';end if;
    for choice in select jsonb_array_elements_text(coalesce(doc->'equipment','[]')) loop
     select * into b from public.aerolog_records where organization_id=p.organization_id and ((kind='battery' and id=choice) or (kind='asset' and data->>'name'=choice));
     if b.id is null then raise exception 'Selected equipment no longer exists';end if;
     if b.kind='battery' and ((b.data->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (b.data->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50) or b.data->>'status' in ('Quarantined','Retired')) then raise exception 'Selected battery requires inspection';end if;
     if b.kind='asset' and (b.data->>'status' not in ('Available','Checked out') or (b.data->>'hours')::numeric >= (b.data->>'next')::numeric) then raise exception 'Selected equipment is unavailable';end if;
    end loop;
   end if;
  end if;
  doc:=doc || jsonb_build_object('history',coalesce(o.data->'history','[]'::jsonb)||jsonb_build_array(status||' by '||p.display_name||' · '||to_char(now(),'YYYY-MM-DD HH24:MI UTC')));
 end if;
 if k='service' and command='service_complete' then
  if o.id is null or o.data->>'status'='Completed' then raise exception 'Work order already complete or not found';end if;
  if trim(coalesce(payload->>'note',''))='' then raise exception 'Service findings required';end if;
  select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=o.data->>'asset' for update;
  if a.id is null then raise exception 'Service equipment not found';end if;
  doc:=o.data || jsonb_build_object('status','Completed','completionNotes',payload->>'note','signedBy',p.display_name,'completedAt',now());
  update public.aerolog_records set data=data || jsonb_build_object('status','Available','next',(data->>'hours')::numeric+coalesce((o.data->>'intervalHours')::numeric,100)),revision=revision+1,updated_at=now() where organization_id=p.organization_id and kind='asset' and id=a.id;
 elsif k='service' then
  if o.data->>'status'='Completed' or doc->>'status'='Completed' then raise exception 'Use service sign-off; completed records are immutable';end if;
 end if;
 if k='battery' and command='battery_cycle' then
  if o.id is null then raise exception 'Battery not found';end if;
  doc:=o.data || jsonb_build_object('cycles',(o.data->>'cycles')::int+1,'health',doc->'health','temp',doc->'temp','status',case when o.data->>'status' in ('Quarantined','Retired') then o.data->>'status' when (doc->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (doc->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50) then 'Attention required' else 'Healthy' end);
  event:=gen_random_uuid()::text;
  insert into public.aerolog_records(organization_id,kind,id,data,created_by) values(p.organization_id,'battery_event',event,jsonb_build_object('id',event,'battery',rid,'cycles',doc->'cycles','health',doc->'health','temp',doc->'temp','date',now(),'notes',coalesce(payload->>'note',''),'recordedBy',p.display_name),p.id);
 end if;
 if k='flight' then
  if not exists(select 1 from public.aerolog_records where organization_id=p.organization_id and kind='crew' and data->>'name'=doc->>'pilot') then raise exception 'Register this pilot before importing flights';end if;
  if coalesce(doc->>'missionId','')<>'' and not exists(select 1 from public.aerolog_records where organization_id=p.organization_id and kind='mission' and id=doc->>'missionId') then raise exception 'Linked mission not found';end if;
  if coalesce(doc->>'battery','')<>'' and not exists(select 1 from public.aerolog_records where organization_id=p.organization_id and kind='battery' and id=doc->>'battery') then raise exception 'Register this battery before logging usage';end if;
  if o.id is not null then raise exception 'Flight records are immutable; append a correction through an administrator';end if;
  if p.role not in ('admin','manager','pilot') then raise exception 'Flight logging permission required' using errcode='42501';end if;
  if p.role='pilot' and doc->>'pilot'<>p.display_name then raise exception 'Pilots may log only their own flights' using errcode='42501';end if;
  select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=doc->>'aircraft' for update;
  if a.id is null or a.data->>'category'<>'Aircraft' then raise exception 'Register this aircraft before importing flights';end if;
  update public.aerolog_records set data=data || jsonb_build_object('hours',round((data->>'hours')::numeric+(doc->>'durationSeconds')::numeric/3600,3)),revision=revision+1,updated_at=now() where organization_id=p.organization_id and kind='asset' and id=a.id;
  if coalesce(doc->>'battery','')<>'' then
   event:=gen_random_uuid()::text;
   insert into public.aerolog_records(organization_id,kind,id,data,created_by) values(p.organization_id,'battery_event',event,jsonb_build_object('id',event,'battery',doc->>'battery','flightId',rid,'date',doc->>'date','start',doc->'start','end',doc->'end','temp',doc->'peakTemperature','durationSeconds',doc->'durationSeconds','recordedBy',p.display_name),p.id);
  end if;
 end if;
 if command not in ('save','review','mission_complete','service_complete','battery_cycle','flight_import') then raise exception 'Unknown command';end if;
 newrev:=coalesce(o.revision,0)+1;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by) values(p.organization_id,k,rid,doc,newrev,p.id)
 on conflict(organization_id,kind,id) do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data) values(p.organization_id,p.id,p.display_name,command,k,rid,o.data,doc);
 if k='mission' and doc->>'status' in ('Pending approval','Approved','Changes requested') then
  insert into public.aerolog_notifications(organization_id,title,body,record_id) values(p.organization_id,'Mission '||lower(doc->>'status'),(doc->>'name')||' · '||p.display_name,rid);
 end if;
 return jsonb_build_object('data',doc,'revision',newrev);
end;
$$;
-- Enforce invariants even when a caller bypasses the HTTP/Zod API.
create function public.aerolog_validate_record() returns trigger language plpgsql set search_path='' as $$
declare d jsonb:=new.data; field text; n numeric;
begin
 if coalesce(d->>'id','')<>new.id then raise exception 'Record ID mismatch';end if;
 if new.kind in ('asset','crew') and TG_OP='UPDATE' and old.data->>'name' is distinct from d->>'name' then
  raise exception 'Names are stable identifiers. Retire this record and create a replacement to preserve historical assignments';
 end if;
 if new.kind in ('asset','crew','mission') and length(trim(coalesce(d->>'name',''))) not between 1 and 160 then raise exception 'Record name required';end if;
 foreach field in array case new.kind when 'asset' then array['hours','next','intervalHours'] when 'battery' then array['cycles','health','temp'] when 'flight' then array['durationSeconds','altitude'] when 'mission' then array['durationMinutes','altitude'] when 'service' then array['intervalHours'] else array[]::text[] end loop
  if jsonb_typeof(d->field) is distinct from 'number' then raise exception 'Numeric field % required',field;end if;
  n:=(d->>field)::numeric;
  if field in ('hours','cycles') and n not between 0 and 100000 or field='health' and n not between 0 and 100 or field='temp' and n not between -50 and 150 or field='durationSeconds' and n not between 1 and 86400 or field='durationMinutes' and n not between 5 and 720 or field='next' and n not between 1 and 100000 or field='intervalHours' and n not between 1 and 10000 or field='altitude' and n not between -1000 and 10000 then raise exception 'Invalid value for %',field;end if;
 end loop;
 if new.kind='flight' and (coalesce(d->>'distance','') !~ '^\d+(\.\d+)?$' or jsonb_typeof(d->'telemetry') is distinct from 'array' or jsonb_array_length(d->'telemetry')>20000) then raise exception 'Invalid flight data';end if;
 if new.kind='mission' and (jsonb_typeof(d->'risks') is distinct from 'array' or jsonb_typeof(d->'equipment') is distinct from 'array' or (d->>'time')::time is null or (d->>'date')::date is null) then raise exception 'Invalid mission data';end if;
 if new.kind='mission' and exists(select 1 from jsonb_array_elements(d->'risks') r where coalesce((r->>'likelihood')::numeric,0) not between 1 and 5 or coalesce((r->>'severity')::numeric,0) not between 1 and 5 or coalesce((r->>'residualLikelihood')::numeric,1) not between 1 and 5 or coalesce((r->>'residualSeverity')::numeric,1) not between 1 and 5) then raise exception 'Invalid risk score';end if;
 if new.kind='attachment' and (left(coalesce(d->>'path',''),37)<>new.organization_id::text||'/' or position('..' in d->>'path')>0) then raise exception 'Invalid attachment path';end if;
 return new;
end;$$;
create trigger aerolog_record_validation before insert or update on public.aerolog_records for each row execute function public.aerolog_validate_record();

-- Metadata registration and mission locking share the same organization transaction lock.
create function public.aerolog_attach(doc jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; m public.aerolog_records;
begin
 select * into p from public.aerolog_profiles where id=auth.uid() and active;
 if p.id is null or p.role not in ('admin','manager','pilot') then raise exception 'Mission planning permission required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.organization_id::text,0));
 select * into m from public.aerolog_records where organization_id=p.organization_id and kind='mission' and id=doc->>'mission';
 if m.id is null or m.data->>'status' not in ('Draft','Changes requested') then raise exception 'Mission attachments are locked';end if;
 if p.role='pilot' and m.created_by<>p.id and m.data->>'pilot'<>p.display_name then raise exception 'This mission belongs to another pilot' using errcode='42501';end if;
 if doc->>'path'<>p.organization_id::text||'/'||(doc->>'mission')||'/'||(doc->>'id') then raise exception 'Invalid attachment path';end if;
 if not exists(select 1 from storage.objects where bucket_id='aerolog-files' and name=doc->>'path') then raise exception 'Uploaded object not found';end if;
 insert into public.aerolog_records(organization_id,kind,id,data,created_by) values(p.organization_id,'attachment',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data) values(p.organization_id,p.id,p.display_name,'attachment_added','mission',m.id,doc);
 return doc;
end;$$;
revoke all on function public.aerolog_attach(jsonb) from public,anon;
grant execute on function public.aerolog_attach(jsonb) to authenticated;
