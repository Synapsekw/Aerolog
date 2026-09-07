alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event'));
create function public.aerolog_equipment_flight_count(org uuid,k text,rid text) returns integer language sql stable set search_path='' as $$
 select count(*)::integer from public.aerolog_records f where f.organization_id=org and f.kind='flight' and
 case when k='battery' then f.data->>'battery'=rid or coalesce(f.data->'batteryIds','[]') ? rid else f.data->>'aircraftId'=rid or coalesce(f.data->'equipmentIds','[]') ? rid or f.data->>'aircraft'=(select a.data->>'name' from public.aerolog_records a where a.organization_id=org and a.kind='asset' and a.id=rid) end;
$$;
create function public.aerolog_inspection_write(actor uuid,expected_org uuid,record_kind text,document jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; old public.aerolog_records; related public.aerolog_records; equipment public.aerolog_records; rule jsonb; doc jsonb:=document; n integer; field text; prior jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager','technician') then raise exception 'Active fleet manager in this organization required' using errcode='42501';end if;
 if record_kind not in ('inspection_profile','inspection_plan','inspection_event') then raise exception 'Invalid inspection kind';end if;
 select * into old from public.aerolog_records where organization_id=expected_org and kind=record_kind and id=doc->>'id' for update;
 if coalesce(old.revision,0)<>expected_revision then raise exception 'Record changed. Refresh before saving.' using errcode='PT409';end if;
 if record_kind<>'inspection_profile' and old.id is not null then raise exception 'Inspection baselines and signed records are immutable';end if;
 if record_kind='inspection_plan' then
  select * into related from public.aerolog_records where organization_id=expected_org and kind='inspection_profile' and id=doc->>'profileId';
  select * into equipment from public.aerolog_records where organization_id=expected_org and kind=doc->>'targetKind' and id=doc->>'targetId';
  if (doc->>'baselineDate')::date<>(now() at time zone (select coalesce(settings->>'timezone','UTC') from public.aerolog_organizations where id=expected_org))::date then raise exception 'New baselines must use the current organization date';end if;
  if related.id is null or related.data->>'archived'='true' or equipment.id is null then raise exception 'Active profile and equipment in this organization required';end if;
  if exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='inspection_plan' and data->>'targetKind'=doc->>'targetKind' and data->>'targetId'=doc->>'targetId' and data->>'profileId'=doc->>'profileId') then raise exception 'This profile is already assigned to the equipment';end if;
  doc:=doc||jsonb_build_object('profileSnapshot',related.data,'profileRevision',related.revision,'capturedFlightCount',public.aerolog_equipment_flight_count(expected_org,doc->>'targetKind',doc->>'targetId'),'capturedAt',now());
 elsif record_kind='inspection_event' then
  select * into related from public.aerolog_records where organization_id=expected_org and kind='inspection_plan' and id=doc->>'planId';
  if related.id is null then raise exception 'Inspection plan not found';end if;
  select r into rule from jsonb_array_elements(related.data->'profileSnapshot'->'rules') r where r->>'id'=doc->>'ruleId';
  if rule is null then raise exception 'Inspection rule not found';end if;
  select data into prior from public.aerolog_records where organization_id=expected_org and kind='inspection_event' and data->>'planId'=doc->>'planId' and data->>'ruleId'=doc->>'ruleId' order by data->>'date' desc,created_at desc limit 1;
  if (doc->>'date')::date < coalesce(prior->>'date',related.data->>'baselineDate')::date or (doc->>'date')::date>(now() at time zone (select coalesce(settings->>'timezone','UTC') from public.aerolog_organizations where id=expected_org))::date then raise exception 'Inspection date must follow its baseline and cannot be in the future';end if;
  foreach field in array array['hours','flights','cycles'] loop
   if rule->>field is not null and doc->'meters'->>field is null then raise exception 'Counter % required for this inspection',field;end if;
   if (doc->'meters'->>field)::numeric < coalesce((prior->'meters'->>field)::numeric,(related.data->'baseline'->>field)::numeric) then raise exception 'Counters cannot decrease';end if;
  end loop;
  doc:=doc||jsonb_build_object('signedBy',p.display_name,'signedById',p.id,'signedAt',now(),'action',rule->>'action','component',rule->>'component');
 end if;
 n:=coalesce(old.revision,0)+1;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by)values(expected_org,record_kind,doc->>'id',doc,n,p.id)on conflict(organization_id,kind,id)do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,p.id,p.display_name,'inspection_saved',record_kind,doc->>'id',old.data,doc);
 return jsonb_build_object('data',doc,'revision',n);
end;$$;
revoke all on function public.aerolog_inspection_write(uuid,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.aerolog_inspection_write(uuid,uuid,text,jsonb,integer) to service_role;
create function public.aerolog_inspection_blockers(org uuid,target_kind text,target_id text,on_date date) returns integer language plpgsql stable set search_path='' as $$
declare plan public.aerolog_records; eq public.aerolog_records; rule jsonb; event jsonb; baseline jsonb; current_meters jsonb; field text; value numeric; base numeric; blocked boolean; total integer:=0; counted integer;
begin
 select * into eq from public.aerolog_records where organization_id=org and kind=target_kind and id=target_id;
 for plan in select * from public.aerolog_records where organization_id=org and kind='inspection_plan' and data->>'targetKind'=target_kind and data->>'targetId'=target_id loop
  counted:=public.aerolog_equipment_flight_count(org,target_kind,target_id);
  current_meters:=jsonb_build_object('hours',eq.data->'hours','cycles',eq.data->'cycles','flights',case when counted<(plan.data->>'capturedFlightCount')::integer then null else (plan.data->'baseline'->>'flights')::numeric+counted-(plan.data->>'capturedFlightCount')::integer end);
  for rule in select * from jsonb_array_elements(plan.data->'profileSnapshot'->'rules') loop
   event:=null;
   select data into event from public.aerolog_records where organization_id=org and kind='inspection_event' and data->>'planId'=plan.id and data->>'ruleId'=rule->>'id' order by data->>'date' desc,created_at desc limit 1;
   baseline:=coalesce(event->'meters',plan.data->'baseline');blocked:=false;
   foreach field in array array['hours','flights','cycles'] loop
    if rule->>field is not null then
     value:=(current_meters->>field)::numeric;base:=(baseline->>field)::numeric;
     if value is null or base is null or value<base or value-base>=(rule->>field)::numeric then blocked:=true;end if;
    end if;
   end loop;
   if rule->>'days' is not null and on_date-coalesce(event->>'date',plan.data->>'baselineDate')::date>=(rule->>'days')::integer then blocked:=true;end if;
   if blocked then total:=total+1;end if;
  end loop;
 end loop;
 return total;
end;$$;
create function public.aerolog_mission_inspection_guard() returns trigger language plpgsql set search_path='' as $$
declare eq public.aerolog_records;
begin
 if new.kind='mission' and new.data->>'status' in ('Pending approval','Approved') then
  for eq in select * from public.aerolog_records where organization_id=new.organization_id and kind in ('asset','battery') and ((kind='asset' and (data->>'name'=any(public.aerolog_mission_aircraft(new.data)) or new.data->'equipment' ? (data->>'name'))) or (kind='battery' and new.data->'equipment' ? id)) loop
   if public.aerolog_inspection_blockers(new.organization_id,eq.kind,eq.id,(new.data->>'date')::date)>0 then raise exception 'Equipment % has an inspection due or missing counters',coalesce(eq.data->>'name',eq.data->>'model',eq.id);end if;
  end loop;
 end if;
 return new;
end;$$;
create trigger mission_inspection_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_mission_inspection_guard();
