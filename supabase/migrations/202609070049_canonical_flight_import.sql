create function public.aerolog_canonical_equipment_id(org uuid,k text,rid text) returns text language plpgsql stable set search_path='' as $$
declare current_id text:=rid;next_id text;seen text[]:='{}';
begin
 if k not in ('asset','battery') or not exists(select 1 from public.aerolog_records where organization_id=org and kind=k and id=rid) then raise exception 'Equipment identity not found in this organization';end if;
 loop
  if current_id=any(seen) then raise exception 'Equipment identity cycle requires repair';end if;seen:=array_append(seen,current_id);
  select canonical_id into next_id from public.aerolog_equipment_aliases where organization_id=org and kind=k and source_id=current_id;
  if next_id is null then return current_id;end if;current_id:=next_id;
 end loop;
end;$$;
create function public.aerolog_route_flight_equipment(org uuid,input jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare doc jsonb:=input-'equipmentIdentitySource';source_aircraft public.aerolog_records;aircraft public.aerolog_records;pack public.aerolog_records;linked_aircraft text;key text;rid text;resolved text;ids jsonb;raw_ids jsonb;source jsonb;
begin
 if coalesce(input->>'aircraftId','')<>'' then
  select * into source_aircraft from public.aerolog_records where organization_id=org and kind='asset' and id=input->>'aircraftId';
 else
  select * into source_aircraft from public.aerolog_records where organization_id=org and kind='asset' and data->>'name'=input->>'aircraft';
 end if;
 if source_aircraft.id is null or source_aircraft.data->>'category'<>'Aircraft' then raise exception 'Register this aircraft before importing flights';end if;
 resolved:=public.aerolog_canonical_equipment_id(org,'asset',source_aircraft.id);
 select * into aircraft from public.aerolog_records where organization_id=org and kind='asset' and id=resolved;
 if aircraft.data->>'category'<>'Aircraft' then raise exception 'Canonical equipment must be an aircraft';end if;
 doc:=doc||jsonb_build_object('aircraftId',aircraft.id,'aircraft',aircraft.data->>'name');
 foreach key in array array['equipmentIds','batteryIds'] loop
  raw_ids:=coalesce(nullif(input->key,'null'::jsonb),'[]'::jsonb);
  if jsonb_typeof(raw_ids)<>'array' or jsonb_array_length(raw_ids)>200 then raise exception 'Invalid equipment identity list';end if;
  if key='batteryIds' and coalesce(input->>'battery','')<>'' then raw_ids:=raw_ids||jsonb_build_array(input->>'battery');end if;
  ids:='[]';
  for rid in select jsonb_array_elements_text(raw_ids) loop
   resolved:=public.aerolog_canonical_equipment_id(org,case when key='batteryIds' then 'battery' else 'asset' end,rid);
   if not ids ? resolved then ids:=ids||jsonb_build_array(resolved);end if;
  end loop;
  if key='batteryIds' then
   for rid in select jsonb_array_elements_text(ids) loop
    select * into pack from public.aerolog_records where organization_id=org and kind='battery' and id=rid;
    select id into linked_aircraft from public.aerolog_records where organization_id=org and kind='asset' and data->>'name'=pack.data->>'aircraft';
    if linked_aircraft is null or public.aerolog_canonical_equipment_id(org,'asset',linked_aircraft)<>aircraft.id then raise exception 'Register this battery for the flight aircraft before logging usage';end if;
   end loop;
  end if;
  if input ? key or ids<>'[]'::jsonb then doc:=doc||jsonb_build_object(key,ids);end if;
 end loop;
 if coalesce(input->>'battery','')<>'' then doc:=doc||jsonb_build_object('battery',public.aerolog_canonical_equipment_id(org,'battery',input->>'battery'));end if;
 source:=jsonb_strip_nulls(jsonb_build_object('aircraftId',input->'aircraftId','aircraft',input->'aircraft','equipmentIds',input->'equipmentIds','battery',input->'battery','batteryIds',input->'batteryIds'));
 if (doc-'equipmentIdentitySource') is distinct from (input-'equipmentIdentitySource') then doc:=doc||jsonb_build_object('equipmentIdentitySource',source);end if;
 return doc;
end;$$;
revoke all on function public.aerolog_canonical_equipment_id(uuid,text,text),public.aerolog_route_flight_equipment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_canonical_equipment_id(uuid,text,text),public.aerolog_route_flight_equipment(uuid,jsonb) to service_role;
create or replace function public.aerolog_command(command text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; expected_org uuid;
begin
 select organization_id into expected_org from public.aerolog_profiles where id=auth.uid() and active;
 if expected_org is null then raise exception 'Active membership required' using errcode='42501'; end if;
 -- Match the existing access and command lock order: organization, then profile.
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=auth.uid() and active for update;
 if p.id is null then raise exception 'Active membership required' using errcode='42501'; end if;
 if p.organization_id<>expected_org or (payload ? '_organizationId' and payload->>'_organizationId'<>p.organization_id::text) then raise exception 'The active organization changed. Refresh before saving.' using errcode='PT409'; end if;
 if payload->>'kind'='flight' then payload:=jsonb_set(payload,'{data}',public.aerolog_route_flight_equipment(p.organization_id,payload->'data'));end if;
 return public.aerolog_command_internal(command,payload-'_organizationId');
end;$$;
-- Extend existing authoritative battery compatibility to every assigned aircraft.
CREATE OR REPLACE FUNCTION public.aerolog_command_internal(command text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if (o.id is null and expected<>0) or (o.id is not null and o.revision<>expected) then raise exception 'This record changed. Refresh and try again.' using errcode='PT409';end if;
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
    if exists(select 1 from public.aerolog_records x where x.organization_id=p.organization_id and x.kind='mission' and x.id<>rid and x.data->>'status' in ('Pending approval','Approved') and ((x.data->>'date')::date+(x.data->>'time')::time) < ((doc->>'date')::date+(doc->>'time')::time+make_interval(mins=>(doc->>'durationMinutes')::int)) and ((doc->>'date')::date+(doc->>'time')::time) < ((x.data->>'date')::date+(x.data->>'time')::time+make_interval(mins=>(x.data->>'durationMinutes')::int)) and (x.data->>'aircraft'=doc->>'aircraft' or x.data->>'pilot' in (doc->>'pilot',doc->>'observer') or x.data->>'observer' in (doc->>'pilot',doc->>'observer') or exists(select 1 from jsonb_array_elements_text(x.data->'equipment') eq where doc->'equipment' ? eq))) then raise exception 'Crew or aircraft is already assigned in this time window';end if;
    for choice in select jsonb_array_elements_text(coalesce(doc->'equipment','[]')) loop
     select * into b from public.aerolog_records where organization_id=p.organization_id and ((kind='battery' and id=choice) or (kind='asset' and data->>'name'=choice));
     if b.id is null then raise exception 'Selected equipment no longer exists';end if;
     if b.kind='battery' and ((b.data->>'aircraft'<>doc->>'aircraft' and not coalesce(doc->'additionalAircraft','[]'::jsonb) ? (b.data->>'aircraft')) or (b.data->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (b.data->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50) or b.data->>'status' in ('Quarantined','Retired')) then raise exception 'Selected battery requires inspection';end if;
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
  for choice in select distinct value from jsonb_array_elements_text(coalesce(doc->'batteryIds','[]') || case when coalesce(doc->>'battery','')<>'' then jsonb_build_array(doc->>'battery') else '[]'::jsonb end) as packs(value) loop
   event:=gen_random_uuid()::text;
   insert into public.aerolog_records(organization_id,kind,id,data,created_by) values(p.organization_id,'battery_event',event,jsonb_build_object('id',event,'battery',choice,'flightId',rid,'date',doc->>'date','start',doc->'start','end',doc->'end','temp',doc->'peakTemperature','durationSeconds',doc->'durationSeconds','recordedBy',p.display_name),p.id);
  end loop;
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
$function$;