-- A route preserves an inspection's signed meter coordinates after consolidation.
create table public.aerolog_inspection_meter_routes(
 organization_id uuid not null,plan_kind text not null default 'inspection_plan' check(plan_kind='inspection_plan'),plan_id text not null,
 target_kind text not null check(target_kind in ('asset','battery')),target_id text not null,
 hours_anchor numeric check(hours_anchor>=0),cycles_anchor numeric check(cycles_anchor>=0),flights_anchor integer not null check(flights_anchor>=0),
 hours_base numeric check(hours_base>=0),cycles_base numeric check(cycles_base>=0),flights_base numeric check(flights_base>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(organization_id,plan_id),
 foreign key(organization_id,plan_kind,plan_id) references public.aerolog_records(organization_id,kind,id),
 foreign key(organization_id,target_kind,target_id) references public.aerolog_records(organization_id,kind,id)
);
alter table public.aerolog_inspection_meter_routes enable row level security;
create policy inspection_meter_route_read on public.aerolog_inspection_meter_routes for select to authenticated using(organization_id=public.aerolog_org());
revoke all on public.aerolog_inspection_meter_routes from anon,authenticated;
grant select on public.aerolog_inspection_meter_routes to authenticated;
create function public.aerolog_equipment_family_flight_count(org uuid,k text,rid text) returns integer language sql stable set search_path='' as $$
 with recursive family(id) as (
 select rid union select a.source_id from public.aerolog_equipment_aliases a join family f on a.canonical_id=f.id where a.organization_id=org and a.kind=k
 )
 select count(*)::integer from public.aerolog_records f where f.organization_id=org and f.kind='flight' and (
 case when k='battery' then f.data->>'battery' in (select id from family) or exists(select 1 from family where coalesce(f.data->'batteryIds','[]') ? id)
 when k='asset' then f.data->>'aircraftId' in (select id from family) or exists(select 1 from family where coalesce(f.data->'equipmentIds','[]') ? id)
 or (coalesce(f.data->>'aircraftId','')='' and coalesce(nullif(f.data->'equipmentIds','null'::jsonb),'[]')='[]'::jsonb and exists(select 1 from public.aerolog_records a join family fam on fam.id=a.id where a.organization_id=org and a.kind='asset' and btrim(coalesce(a.data->>'name',''))<>'' and a.data->>'name'=f.data->>'aircraft')) else false end);
$$;
create function public.aerolog_inspection_current_meters(org uuid,pid text) returns jsonb language plpgsql stable set search_path='' as $$
declare plan public.aerolog_records;route public.aerolog_inspection_meter_routes;eq public.aerolog_records;counted integer;result jsonb;unit text;anchor numeric;base numeric;current_value numeric;
begin
 select * into plan from public.aerolog_records where organization_id=org and kind='inspection_plan' and id=pid;
 if plan.id is null then raise exception 'Inspection plan not found';end if;
 select * into route from public.aerolog_inspection_meter_routes where organization_id=org and plan_id=pid;
 if route.plan_id is null then
  select * into eq from public.aerolog_records where organization_id=org and kind=plan.data->>'targetKind' and id=plan.data->>'targetId';
  counted:=public.aerolog_equipment_flight_count(org,plan.data->>'targetKind',plan.data->>'targetId');
  return jsonb_build_object('hours',eq.data->'hours','cycles',eq.data->'cycles','flights',case when counted<(plan.data->>'capturedFlightCount')::integer then null else (plan.data->'baseline'->>'flights')::numeric+counted-(plan.data->>'capturedFlightCount')::integer end);
 end if;
 select * into eq from public.aerolog_records where organization_id=org and kind=route.target_kind and id=route.target_id;
 counted:=public.aerolog_equipment_family_flight_count(org,route.target_kind,route.target_id);
 result:='{}';
 foreach unit in array array['hours','cycles','flights'] loop
  anchor:=(to_jsonb(route)->>(unit||'_anchor'))::numeric;base:=(to_jsonb(route)->>(unit||'_base'))::numeric;
  current_value:=case when unit='flights' then counted else (eq.data->>unit)::numeric end;
  result:=result||jsonb_build_object(unit,case when current_value is null or anchor is null or base is null or current_value<anchor then null else base+current_value-anchor end);
 end loop;
 return result;
end;$$;
revoke all on function public.aerolog_equipment_family_flight_count(uuid,text,text),public.aerolog_inspection_current_meters(uuid,text) from public,anon,authenticated;
grant execute on function public.aerolog_equipment_family_flight_count(uuid,text,text),public.aerolog_inspection_current_meters(uuid,text) to service_role;
create or replace function public.aerolog_inspection_blockers(org uuid,target_kind text,target_id text,on_date date) returns integer language plpgsql stable set search_path='' as $$
declare plan public.aerolog_records; eq public.aerolog_records; rule jsonb; event jsonb; baseline jsonb; current_meters jsonb; field text; value numeric; base numeric; blocked boolean; total integer:=0; counted integer;
begin
 select * into eq from public.aerolog_records where organization_id=org and kind=target_kind and id=target_id;
 for plan in select * from public.aerolog_records where organization_id=org and kind='inspection_plan' and ((data->>'targetKind'=target_kind and data->>'targetId'=target_id) or exists(select 1 from public.aerolog_inspection_meter_routes route where route.organization_id=org and route.plan_id=aerolog_records.id and route.target_kind=aerolog_inspection_blockers.target_kind and route.target_id=aerolog_inspection_blockers.target_id)) loop
  current_meters:=public.aerolog_inspection_current_meters(org,plan.id);
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
