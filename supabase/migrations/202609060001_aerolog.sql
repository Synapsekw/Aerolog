-- AEROLOG owns only aerolog_* tables/functions. Existing project data is preserved.
create table public.aerolog_organizations (
 id uuid primary key default gen_random_uuid(), name text not null,
 settings jsonb not null default '{"timezone":"Asia/Dubai","batteryMinHealth":80,"batteryMaxTemperature":50,"allowSelfApproval":false}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.aerolog_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid not null references public.aerolog_organizations(id),
 display_name text not null, role text not null check (role in ('admin','manager','pilot','technician','observer')),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.aerolog_records (
 organization_id uuid not null references public.aerolog_organizations(id),
 kind text not null check (kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment')),
 id text not null check (length(id) between 1 and 100), data jsonb not null check (jsonb_typeof(data)='object'),
 revision integer not null default 1, created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(organization_id,kind,id)
);
create unique index aerolog_asset_serial on public.aerolog_records(organization_id, lower(data->>'serial')) where kind='asset';
create unique index aerolog_asset_name on public.aerolog_records(organization_id, lower(data->>'name')) where kind='asset';
create unique index aerolog_crew_name on public.aerolog_records(organization_id, lower(data->>'name')) where kind='crew';
create unique index aerolog_flight_hash on public.aerolog_records(organization_id, (data->>'importHash')) where kind='flight' and data->>'importHash' is not null;
create index aerolog_records_updated on public.aerolog_records(organization_id,updated_at desc);
create table public.aerolog_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aerolog_organizations(id),
 actor_id uuid references auth.users(id), actor_name text not null, action text not null, kind text not null,
 record_id text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table public.aerolog_notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aerolog_organizations(id),
 recipient_id uuid references auth.users(id), title text not null, body text not null,
 record_id text, read_by uuid[] not null default '{}', created_at timestamptz not null default now()
);
create table public.aerolog_email_outbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aerolog_organizations(id),
 recipient text not null, subject text not null, body text not null, status text not null default 'pending',
 error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create function public.aerolog_org() returns uuid language sql stable security definer set search_path='' as $$
 select organization_id from public.aerolog_profiles where id=auth.uid() and active;
$$;
create function public.aerolog_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.aerolog_profiles where id=auth.uid() and active;
$$;
alter table public.aerolog_organizations enable row level security;
alter table public.aerolog_profiles enable row level security;
alter table public.aerolog_records enable row level security;
alter table public.aerolog_audit enable row level security;
alter table public.aerolog_notifications enable row level security;
alter table public.aerolog_email_outbox enable row level security;
create policy org_read on public.aerolog_organizations for select to authenticated using(id=public.aerolog_org());
create policy profile_read on public.aerolog_profiles for select to authenticated using(organization_id=public.aerolog_org());
create policy record_read on public.aerolog_records for select to authenticated using(organization_id=public.aerolog_org());
create policy audit_read on public.aerolog_audit for select to authenticated using(organization_id=public.aerolog_org());
create policy notification_read on public.aerolog_notifications for select to authenticated using(organization_id=public.aerolog_org() and (recipient_id is null or recipient_id=auth.uid()));
create policy email_read on public.aerolog_email_outbox for select to authenticated using(organization_id=public.aerolog_org() and public.aerolog_role() in ('admin','manager'));
grant select on public.aerolog_organizations,public.aerolog_profiles,public.aerolog_records,public.aerolog_audit,public.aerolog_notifications,public.aerolog_email_outbox to authenticated;
revoke insert,update,delete on public.aerolog_organizations,public.aerolog_profiles,public.aerolog_records,public.aerolog_audit,public.aerolog_notifications,public.aerolog_email_outbox from anon,authenticated;

-- All operational changes pass through this transaction. RLS never trusts client roles.
create function public.aerolog_command(command text, payload jsonb) returns jsonb
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
  update public.aerolog_organizations set settings=settings || payload where id=p.organization_id;
  insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)
   values(p.organization_id,p.id,p.display_name,command,'organization',p.organization_id::text,payload);
  return '{"ok":true}'::jsonb;
 end if;
 k:=payload->>'kind';doc:=payload->'data';rid:=doc->>'id';expected:=coalesce((payload->>'revision')::integer,0);
 if k not in ('mission','asset','battery','crew','flight','service','attachment') or rid is null then raise exception 'Invalid record';end if;
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
    if (doc->>'date')::date<current_date then raise exception 'Cannot submit a mission scheduled in the past';end if;
    if jsonb_array_length(coalesce(doc->'risks','[]'))=0 then raise exception 'Risk assessment required';end if;
    if exists(select 1 from jsonb_array_elements(doc->'risks') r where not coalesce((r->>'controlled')::boolean,false) or trim(coalesce(r->>'mitigation',''))='' or trim(coalesce(r->>'hazard',''))='') then raise exception 'Review every hazard and mitigation';end if;
    select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=doc->>'aircraft';
    if a.id is null or a.data->>'status' not in ('Available','Checked out') or (a.data->>'hours')::numeric>=(a.data->>'next')::numeric then raise exception 'Aircraft is unavailable or requires maintenance';end if;
    foreach choice in array array[doc->>'pilot',doc->>'observer'] loop
     select count(*) into count_rows from public.aerolog_records where organization_id=p.organization_id and kind='crew' and data->>'name'=choice and data->>'status'='Available' and (data->>'expires')::date>=(doc->>'date')::date;
     if count_rows=0 then raise exception 'Crew certification or availability must be updated';end if;
    end loop;
    if exists(select 1 from public.aerolog_records x where x.organization_id=p.organization_id and x.kind='mission' and x.id<>rid and x.data->>'status' in ('Pending approval','Approved') and x.data->>'date'=doc->>'date' and (x.data->>'time')::time < ((doc->>'time')::time+make_interval(mins=>coalesce((doc->>'durationMinutes')::int,60)))::time and (doc->>'time')::time < ((x.data->>'time')::time+make_interval(mins=>coalesce((x.data->>'durationMinutes')::int,60)))::time and (x.data->>'aircraft'=doc->>'aircraft' or x.data->>'pilot' in (doc->>'pilot',doc->>'observer') or x.data->>'observer' in (doc->>'pilot',doc->>'observer'))) then raise exception 'Crew or aircraft is already assigned in this time window';end if;
    for choice in select jsonb_array_elements_text(coalesce(doc->'equipment','[]')) loop
     select * into b from public.aerolog_records where organization_id=p.organization_id and ((kind='battery' and id=choice) or (kind='asset' and data->>'name'=choice));
     if b.id is null then raise exception 'Selected equipment no longer exists';end if;
     if b.kind='battery' and ((b.data->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (b.data->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50) or b.data->>'status'='Quarantined') then raise exception 'Selected battery requires inspection';end if;
     if b.kind='asset' and b.data->>'status' not in ('Available','Checked out') then raise exception 'Selected equipment is unavailable';end if;
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
  doc:=o.data || jsonb_build_object('cycles',(o.data->>'cycles')::int+1,'health',doc->'health','temp',doc->'temp','status',case when (doc->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (doc->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50) then 'Attention required' else 'Healthy' end);
  event:=gen_random_uuid()::text;
  insert into public.aerolog_records(organization_id,kind,id,data,created_by) values(p.organization_id,'battery_event',event,jsonb_build_object('id',event,'battery',rid,'cycles',doc->'cycles','health',doc->'health','temp',doc->'temp','date',now(),'notes',coalesce(payload->>'note',''),'recordedBy',p.display_name),p.id);
 end if;
 if k='flight' then
  if o.id is not null then raise exception 'Flight records are immutable; append a correction through an administrator';end if;
  if p.role not in ('admin','manager','pilot') then raise exception 'Flight logging permission required' using errcode='42501';end if;
  if p.role='pilot' and doc->>'pilot'<>p.display_name then raise exception 'Pilots may log only their own flights' using errcode='42501';end if;
  select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=doc->>'aircraft' for update;
  if a.id is null then raise exception 'Register this aircraft before importing flights';end if;
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
revoke all on function public.aerolog_command(text,jsonb) from public,anon;
grant execute on function public.aerolog_command(text,jsonb) to authenticated;
revoke all on function public.aerolog_org(),public.aerolog_role() from public,anon;
grant execute on function public.aerolog_org(),public.aerolog_role() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('aerolog-files','aerolog-files',false,26214400,array['application/pdf','text/plain','text/csv','application/json','application/octet-stream','image/jpeg','image/png'])
 on conflict(id) do nothing;
