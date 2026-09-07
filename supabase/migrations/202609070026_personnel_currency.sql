create function public.aerolog_currency_summary(org uuid,person jsonb,on_date date) returns jsonb language plpgsql stable set search_path='' as $$
declare policy jsonb:=person->'currencyPolicy';start_date date;local_flights integer;local_minutes numeric;external_flights integer;external_minutes numeric;total_flights integer;total_minutes numeric;
begin
 start_date:=on_date-coalesce((policy->>'days')::integer,90);
 select count(*),coalesce(sum((data->>'durationSeconds')::numeric/60),0) into local_flights,local_minutes from public.aerolog_records where organization_id=org and kind='flight' and nullif(data->>'date','')::date>=start_date and nullif(data->>'date','')::date<on_date and (case when coalesce(data->>'pilotUserId','')<>'' then data->>'pilotUserId'=person->>'authUserId' else data->>'pilot'=person->>'name' end);
 select coalesce(sum((e->>'flights')::integer),0),coalesce(sum((e->>'minutes')::numeric),0) into external_flights,external_minutes from jsonb_array_elements(coalesce(person->'externalTime','[]')) e where (e->>'date')::date>=start_date and (e->>'date')::date<on_date;
 total_flights:=local_flights+case when policy->>'includeExternal'='true' then external_flights else 0 end;total_minutes:=local_minutes+case when policy->>'includeExternal'='true' then external_minutes else 0 end;
 return jsonb_build_object('localFlights',local_flights,'localMinutes',local_minutes,'externalFlights',external_flights,'externalMinutes',external_minutes,'count',total_flights,'minutes',total_minutes,'met',coalesce(policy->>'enabled','false')<>'true' or (total_flights>=coalesce((policy->>'minimumFlights')::integer,0) and total_minutes>=coalesce((policy->>'minimumMinutes')::numeric,0)));
end;$$;
create function public.aerolog_currency_guard() returns trigger language plpgsql set search_path='' as $$
declare previous jsonb;item jsonb;prior_item jsonb;entries jsonb:='[]';policy jsonb;actor public.aerolog_profiles;timezone text;person public.aerolog_records;name text;pilots text[];
begin
 if new.kind='crew' then
  if TG_OP='INSERT' then select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='crew' and id=new.id;else previous:=old.data;end if;
  policy:=new.data->'currencyPolicy';
  if policy is not null and (jsonb_typeof(policy->'enabled') is distinct from 'boolean' or (policy->>'days')::integer not between 1 and 730 or (policy->>'minimumFlights')::numeric<0 or (policy->>'minimumMinutes')::numeric<0 or (policy->>'enabled'='true' and (policy->>'minimumFlights')::numeric<=0 and (policy->>'minimumMinutes')::numeric<=0)) then raise exception 'Invalid recency policy';end if;
  if jsonb_typeof(coalesce(new.data->'externalTime','[]'))<>'array' or jsonb_array_length(coalesce(new.data->'externalTime','[]'))>1000 then raise exception 'Invalid external time ledger';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(previous->'externalTime','[]')) old_entry where not exists(select 1 from jsonb_array_elements(coalesce(new.data->'externalTime','[]')) e where e->>'id'=old_entry->>'id')) then raise exception 'Recorded external time cannot be removed';end if;
  if (select count(*) from jsonb_array_elements(coalesce(new.data->'externalTime','[]')))<>(select count(distinct e->>'id') from jsonb_array_elements(coalesce(new.data->'externalTime','[]')) e) then raise exception 'Duplicate external time entry';end if;
  for item in select value from jsonb_array_elements(coalesce(new.data->'externalTime','[]')) loop
   select value into prior_item from jsonb_array_elements(coalesce(previous->'externalTime','[]')) where value->>'id'=item->>'id';
   if prior_item is not null then
    if (prior_item-'recordedBy'-'recordedAt') is distinct from (item-'recordedBy'-'recordedAt') then raise exception 'Recorded external time is immutable';end if;
    item:=prior_item;
   else
    select * into actor from public.aerolog_profiles where id=auth.uid() and organization_id=new.organization_id and active;
    if actor.id is null or actor.role not in ('admin','manager') then raise exception 'Manager verification required for external time' using errcode='42501';end if;
    select coalesce(settings->>'timezone','UTC') into timezone from public.aerolog_organizations where id=new.organization_id;
    if (item->>'date')::date>(now() at time zone timezone)::date or (item->>'flights')::integer<1 or (item->>'minutes')::numeric<=0 then raise exception 'External time requires past or current date and positive flight/time totals';end if;
    if not exists(select 1 from public.aerolog_records where organization_id=new.organization_id and kind='attachment' and id=item->>'evidenceId' and data->>'targetKind'='crew' and data->>'targetId'=new.id) then raise exception 'External time requires this person''s evidence';end if;
    item:=item||jsonb_build_object('recordedBy',actor.display_name,'recordedAt',now());
   end if;
   entries:=entries||jsonb_build_array(item);
  end loop;
  new.data:=new.data||jsonb_build_object('externalTime',entries);return new;
 end if;
 if new.kind<>'mission' or new.data->>'status' not in ('Pending approval','Approved') then return new;end if;
 pilots:=array[new.data->>'pilot'];for item in select value from jsonb_array_elements(coalesce(new.data->'crewAssignments','[]')) where value->>'role' in ('Second pilot','Instructor') loop pilots:=array_append(pilots,item->>'name');end loop;
 foreach name in array pilots loop
  select * into person from public.aerolog_records where organization_id=new.organization_id and kind='crew' and data->>'name'=name;
  if person.id is not null and not (public.aerolog_currency_summary(new.organization_id,person.data,(new.data->>'date')::date)->>'met')::boolean then raise exception 'Pilot % does not meet the configured recency policy',name;end if;
 end loop;
 return new;
end;$$;
create trigger personnel_currency_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_currency_guard();
