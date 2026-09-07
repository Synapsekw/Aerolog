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
  if coalesce(doc->>'battery','')<>'' and not exists(select 1 from public.aerolog_records where organization_id=p.organization_id and kind='battery' and id=doc->>'battery' and data->>'aircraft'=doc->>'aircraft') then raise exception 'Register this battery before logging usage';end if;
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
$function$;

create function public.aerolog_mission_aircraft(d jsonb) returns text[] language sql immutable set search_path='' as $$
 select array(select distinct n from (select d->>'aircraft' n union all select jsonb_array_elements_text(coalesce(d->'additionalAircraft','[]'))) x where n is not null and n<>'');
$$;
create function public.aerolog_mission_people(d jsonb) returns text[] language sql immutable set search_path='' as $$
 select array(select distinct n from (select d->>'pilot' n union all select d->>'observer' union all select a->>'name' from jsonb_array_elements(coalesce(d->'crewAssignments','[]')) a) x where n is not null and n<>'');
$$;
create function public.aerolog_validate_mission_resources() returns trigger language plpgsql set search_path='' as $$
declare d jsonb:=new.data; names text[]; people text[]; choice text; equipment public.aerolog_records; crew public.aerolog_records; rules jsonb; other public.aerolog_records; all_equipment text[];
begin
 if new.kind<>'mission' then return new; end if;
 if jsonb_typeof(coalesce(d->'additionalAircraft','[]'))<>'array' or jsonb_array_length(coalesce(d->'additionalAircraft','[]'))>20 or jsonb_typeof(coalesce(d->'crewAssignments','[]'))<>'array' or jsonb_array_length(coalesce(d->'crewAssignments','[]'))>40 then raise exception 'Invalid mission assignments'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(d->'crewAssignments','[]')) a where coalesce(a->>'role','') not in ('Payload operator','Ground support','Instructor','Second pilot') or coalesce(length(trim(a->>'name')),0) not between 1 and 160) then raise exception 'Invalid operational role'; end if;
 names:=public.aerolog_mission_aircraft(d);people:=public.aerolog_mission_people(d);
 if cardinality(names)<>jsonb_array_length(coalesce(d->'additionalAircraft','[]'))+(case when coalesce(d->>'aircraft','')='' then 0 else 1 end) then raise exception 'Select each aircraft once'; end if;
 if d->>'status' not in ('Pending approval','Approved') then return new; end if;
 select settings into rules from public.aerolog_organizations where id=new.organization_id;
 foreach choice in array names loop
  select * into equipment from public.aerolog_records where organization_id=new.organization_id and kind='asset' and data->>'name'=choice;
  if equipment.id is null or equipment.data->>'category'<>'Aircraft' or equipment.data->>'status' not in ('Available','Checked out') or equipment.data->>'hours' is null or equipment.data->>'next' is null or (equipment.data->>'hours')::numeric>=(equipment.data->>'next')::numeric then raise exception 'Aircraft % is unavailable or needs service review',choice; end if;
 end loop;
 foreach choice in array people loop
  select * into crew from public.aerolog_records where organization_id=new.organization_id and kind='crew' and data->>'name'=choice;
  if crew.id is null or crew.data->>'status'<>'Available' or (crew.data->>'expires')::date < (d->>'date')::date then raise exception 'Crew % needs qualification or availability review',choice; end if;
  if exists(select 1 from public.aerolog_memberships m where m.organization_id=new.organization_id and not m.active and ((crew.data->>'authUserId' is not null and m.user_id::text=crew.data->>'authUserId') or (crew.data->>'authUserId' is null and m.display_name=choice))) then raise exception 'Crew % has disabled organization access',choice; end if;
 end loop;
 for choice in select jsonb_array_elements_text(d->'equipment') loop
  select * into equipment from public.aerolog_records where organization_id=new.organization_id and ((kind='asset' and data->>'name'=choice) or (kind='battery' and id=choice));
  if equipment.id is null then raise exception 'Selected equipment does not exist'; end if;
  if equipment.kind='asset' and (equipment.data->>'status' not in ('Available','Checked out') or equipment.data->>'hours' is null or equipment.data->>'next' is null or (equipment.data->>'hours')::numeric >= (equipment.data->>'next')::numeric) then raise exception 'Equipment % is unavailable or needs service review',choice; end if;
  if equipment.kind='battery' and (not equipment.data->>'aircraft'=any(names) or equipment.data->>'status' not in ('Healthy','Attention required') or equipment.data->>'health' is null or equipment.data->>'temp' is null or (equipment.data->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (equipment.data->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50)) then raise exception 'Battery % needs compatibility or measurement review',choice; end if;
 end loop;
 for other in select * from public.aerolog_records x where x.organization_id=new.organization_id and x.kind='mission' and x.id<>new.id and x.data->>'status' in ('Pending approval','Approved') and ((x.data->>'date')::date+(x.data->>'time')::time)<((d->>'date')::date+(d->>'time')::time+make_interval(mins=>(d->>'durationMinutes')::integer)) and ((d->>'date')::date+(d->>'time')::time)<((x.data->>'date')::date+(x.data->>'time')::time+make_interval(mins=>(x.data->>'durationMinutes')::integer)) loop
  if public.aerolog_mission_aircraft(other.data)&&names or public.aerolog_mission_people(other.data)&&people or exists(select 1 from jsonb_array_elements_text(other.data->'equipment') i where d->'equipment' ? i) then raise exception 'Resource conflict with mission %',other.data->>'name'; end if;
 end loop;
 return new;
end;$$;
create trigger mission_resource_validation before insert or update on public.aerolog_records for each row execute function public.aerolog_validate_mission_resources();
-- Extend snapshot membership validation to additional aircraft without recapturing existing snapshots.
create or replace function public.aerolog_mission_kit_snapshot() returns trigger language plpgsql set search_path='' as $$
declare selection jsonb; kit public.aerolog_records; item jsonb; inventory public.aerolog_records; snapshots jsonb:='[]'; snapshot jsonb; contents jsonb; previous_selection jsonb; previous_snapshot jsonb;
begin
 if new.kind<>'mission' then return new; end if;
 if TG_OP='UPDATE' and old.data->>'status' not in ('Draft','Changes requested') then
  new.data:=new.data||jsonb_build_object('kitSelections',coalesce(old.data->'kitSelections','[]'),'kitSnapshots',coalesce(old.data->'kitSnapshots','[]'));
  return new;
 end if;
 if jsonb_typeof(coalesce(new.data->'kitSelections','[]'))<>'array' or jsonb_array_length(coalesce(new.data->'kitSelections','[]'))>20 then raise exception 'Invalid kit selection'; end if;
 for selection in select * from jsonb_array_elements(coalesce(new.data->'kitSelections','[]')) loop
  if exists(select 1 from jsonb_array_elements(snapshots) s where s->>'id'=selection->>'id') then raise exception 'Duplicate kit selection'; end if;
  previous_snapshot:=null;
  if TG_OP='UPDATE' then
   select s into previous_snapshot from jsonb_array_elements(coalesce(old.data->'kitSnapshots','[]')) s where s->>'id'=selection->>'id' and s->>'revision'=selection->>'revision';
  end if;
  if previous_snapshot is not null then
   snapshot:=previous_snapshot;
  else
   select * into kit from public.aerolog_records where organization_id=new.organization_id and kind='kit' and id=selection->>'id';
   if kit.id is null or kit.data->>'archived'='true' then raise exception 'Selected kit is unavailable'; end if;
   if kit.revision::text is distinct from selection->>'revision' then raise exception 'Kit changed. Preview and apply its current version.' using errcode='PT409'; end if;
   contents:='[]';
   for item in select * from jsonb_array_elements(kit.data->'items') loop
    select * into inventory from public.aerolog_records where organization_id=new.organization_id and kind=item->>'kind' and id=item->>'id';
    if inventory.id is null then raise exception 'Kit equipment no longer exists'; end if;
    contents:=contents||jsonb_build_array(jsonb_build_object('kind',inventory.kind,'id',inventory.id,'name',coalesce(inventory.data->>'name',inventory.data->>'sourceName',inventory.data->>'model',inventory.id),'serial',coalesce(inventory.data->>'serial',''),'status',inventory.data->>'status'));
   end loop;
   snapshot:=jsonb_build_object('id',kit.id,'revision',kit.revision,'name',kit.data->>'name','capturedAt',now(),'items',contents);
  end if;
  -- A snapshot must describe equipment actually selected, even in a draft.
  for item in select * from jsonb_array_elements(snapshot->'items') loop
   if item->>'kind'='battery' then
    if not (new.data->'equipment' ? (item->>'id')) then raise exception 'Kit battery removed. Unlink the kit or restore its equipment.'; end if;
   elsif not (item->>'name'=any(public.aerolog_mission_aircraft(new.data))) and not (new.data->'equipment' ? (item->>'name')) then
    raise exception 'Kit equipment removed. Unlink the kit or restore its equipment.';
   end if;
  end loop;
  snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 new.data:=new.data||jsonb_build_object('kitSelections',coalesce(new.data->'kitSelections','[]'),'kitSnapshots',snapshots);
 return new;
end;$$;
