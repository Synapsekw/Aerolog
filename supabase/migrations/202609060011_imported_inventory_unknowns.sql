create or replace function public.aerolog_validate_record() returns trigger language plpgsql set search_path='' as $$
declare d jsonb:=new.data; field text; n numeric;
begin
 if coalesce(d->>'id','')<>new.id then raise exception 'Record ID mismatch';end if;
 if new.kind in ('asset','crew') and TG_OP='UPDATE' and old.data->>'name' is distinct from d->>'name' then
  raise exception 'Names are stable identifiers. Retire this record and create a replacement to preserve historical assignments';
 end if;
 if new.kind in ('asset','crew','mission') and length(trim(coalesce(d->>'name',''))) not between 1 and 160 then raise exception 'Record name required';end if;
 foreach field in array case new.kind when 'asset' then array['hours','next','intervalHours'] when 'battery' then array['cycles','health','temp'] when 'flight' then array['durationSeconds','altitude'] when 'mission' then array['durationMinutes','altitude'] when 'service' then array['intervalHours'] else array[]::text[] end loop
  if new.kind in ('asset','battery') and field in ('hours','next','intervalHours','health','temp') and jsonb_typeof(d->field) = 'null' then continue; end if;
  if jsonb_typeof(d->field) is distinct from 'number' then raise exception 'Numeric field % required',field;end if;
  n:=(d->>field)::numeric;
  if field in ('hours','cycles') and n not between 0 and 100000 or field='health' and n not between 0 and 100 or field='temp' and n not between -50 and 150 or field='durationSeconds' and n not between 1 and 86400 or field='durationMinutes' and n not between 5 and 720 or field='next' and n not between 1 and 100000 or field='intervalHours' and n not between 1 and 10000 or field='altitude' and n not between -1000 and 10000 then raise exception 'Invalid value for %',field;end if;
 end loop;
 if new.kind='flight' and (coalesce(d->>'distance','') !~ '^\d+(\.\d+)?$' or jsonb_typeof(d->'telemetry') is distinct from 'array' or jsonb_array_length(d->'telemetry')>20000) then raise exception 'Invalid flight data';end if;
 if new.kind='mission' and (jsonb_typeof(d->'risks') is distinct from 'array' or jsonb_typeof(d->'equipment') is distinct from 'array' or (d->>'time')::time is null or (d->>'date')::date is null) then raise exception 'Invalid mission data';end if;
 if new.kind='mission' and exists(select 1 from jsonb_array_elements(d->'risks') r where coalesce((r->>'likelihood')::numeric,0) not between 1 and 5 or coalesce((r->>'severity')::numeric,0) not between 1 and 5 or coalesce((r->>'residualLikelihood')::numeric,1) not between 1 and 5 or coalesce((r->>'residualSeverity')::numeric,1) not between 1 and 5) then raise exception 'Invalid risk score';end if;
 if new.kind='attachment' and (left(coalesce(d->>'path',''),37)<>new.organization_id::text||'/' or position('..' in d->>'path')>0) then raise exception 'Invalid attachment path';end if;
 if new.kind='mission' and d->>'status' in ('Pending approval','Approved') and exists(
  select 1 from public.aerolog_records x where x.organization_id=new.organization_id and x.kind in ('asset','battery')
  and (x.data->>'status'='Unverified' or (x.kind='battery' and (x.data->>'health' is null or x.data->>'temp' is null)) or (x.kind='asset' and (x.data->>'hours' is null or x.data->>'next' is null))) and (x.data->>'name'=d->>'aircraft' or (d->'equipment') ? x.id or (d->'equipment') ? (x.data->>'name'))
 ) then raise exception 'Imported equipment must be reviewed before mission use';end if;
 return new;
end;$$;
