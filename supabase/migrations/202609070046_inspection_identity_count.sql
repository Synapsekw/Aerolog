-- Explicit equipment identities take precedence over legacy display names.
create or replace function public.aerolog_equipment_flight_count(org uuid,k text,rid text) returns integer language sql stable set search_path='' as $$
 select count(*)::integer from public.aerolog_records f
 where f.organization_id=org and f.kind='flight' and
 case when k='battery' then f.data->>'battery'=rid or coalesce(f.data->'batteryIds','[]') ? rid
 when k='asset' then f.data->>'aircraftId'=rid or coalesce(nullif(f.data->'equipmentIds','null'::jsonb),'[]') ? rid or (
   coalesce(f.data->>'aircraftId','')='' and coalesce(nullif(f.data->'equipmentIds','null'::jsonb),'[]')='[]'::jsonb
   and exists(select 1 from public.aerolog_records a where a.organization_id=org and a.kind='asset' and a.id=rid
     and btrim(coalesce(a.data->>'name',''))<>'' and f.data->>'aircraft'=a.data->>'name'
     and not exists(select 1 from public.aerolog_records other where other.organization_id=org and other.kind='asset' and other.id<>rid and other.data->>'name'=a.data->>'name'))
 ) else false end;
$$;
