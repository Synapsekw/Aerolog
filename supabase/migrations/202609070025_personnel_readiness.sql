create function public.aerolog_personnel_readiness_guard() returns trigger language plpgsql set search_path='' as $$
declare person public.aerolog_records;item jsonb;person_name text;aircraft_name text;aircraft public.aerolog_records;pilots text[];
begin
 if new.kind='crew' then
  if coalesce(new.data->>'aircraftPermission','Not configured') not in ('Not configured','All aircraft','Selected aircraft') then raise exception 'Choose an explicit aircraft permission policy';end if;
  if jsonb_typeof(coalesce(new.data->'authorizedAircraftIds','[]'))<>'array' or jsonb_typeof(coalesce(new.data->'qualifications','[]'))<>'array' then raise exception 'Invalid personnel credentials';end if;
  for item in select value from jsonb_array_elements(coalesce(new.data->'authorizedAircraftIds','[]')) loop
   if not exists(select 1 from public.aerolog_records where organization_id=new.organization_id and kind='asset' and data->>'category'='Aircraft' and id=item#>>'{}') then raise exception 'Authorized aircraft not found in this organization';end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(new.data->'qualifications','[]')) loop
   if length(btrim(coalesce(item->>'name','')))=0 or (item->>'expires')::date is null or jsonb_typeof(item->'requiredForOperations') is distinct from 'boolean' then raise exception 'Qualification name, expiry and requirement are required';end if;
   if coalesce(item->>'issued','')<>'' and (item->>'issued')::date>(item->>'expires')::date then raise exception 'Qualification expires before issue';end if;
   if coalesce(item->>'evidenceId','')<>'' and not exists(select 1 from public.aerolog_records where organization_id=new.organization_id and kind='attachment' and id=item->>'evidenceId' and data->>'targetKind'='crew' and data->>'targetId'=new.id) then raise exception 'Qualification evidence must belong to this person';end if;
  end loop;
  return new;
 end if;
 if new.kind<>'mission' or new.data->>'status' not in ('Pending approval','Approved') then return new;end if;
 foreach person_name in array public.aerolog_mission_people(new.data) loop
  select * into person from public.aerolog_records where organization_id=new.organization_id and kind='crew' and data->>'name'=person_name;
  for item in select value from jsonb_array_elements(coalesce(person.data->'qualifications','[]')) loop
   if item->>'requiredForOperations'='true' and ((item->>'expires')::date<(new.data->>'date')::date or (nullif(item->>'issued',''))::date>(new.data->>'date')::date or coalesce(item->>'evidenceId','')='') then raise exception 'Crew % qualification % requires valid dates and evidence',person_name,item->>'name';end if;
  end loop;
 end loop;
 pilots:=array[new.data->>'pilot'];
 for item in select value from jsonb_array_elements(coalesce(new.data->'crewAssignments','[]')) where value->>'role' in ('Second pilot','Instructor') loop pilots:=array_append(pilots,item->>'name');end loop;
 foreach person_name in array pilots loop
  select * into person from public.aerolog_records where organization_id=new.organization_id and kind='crew' and data->>'name'=person_name;
  if coalesce(person.data->>'aircraftPermission','Not configured')='Not configured' then raise exception 'Configure aircraft permissions for pilot %',person_name;end if;
  if person.data->>'aircraftPermission'='Selected aircraft' then
   foreach aircraft_name in array public.aerolog_mission_aircraft(new.data) loop
    select * into aircraft from public.aerolog_records where organization_id=new.organization_id and kind='asset' and data->>'name'=aircraft_name;
    if not coalesce(person.data->'authorizedAircraftIds','[]') ? aircraft.id then raise exception 'Pilot % is not authorized for aircraft %',person_name,aircraft_name;end if;
   end loop;
  end if;
 end loop;
 return new;
end;$$;
create trigger personnel_readiness_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_personnel_readiness_guard();
create function public.aerolog_crew_attach(actor uuid,expected_org uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;doc jsonb:=document;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Active organization manager required' using errcode='42501';end if;
 if doc->>'targetKind'<>'crew' or not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='crew' and id=doc->>'targetId') then raise exception 'Crew not found';end if;
 if doc->>'path' is distinct from expected_org::text||'/personnel/'||(doc->>'id') then raise exception 'Invalid personnel attachment path';end if;
 doc:=doc||jsonb_build_object('uploadedBy',p.display_name,'uploadedAt',now());
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'attachment',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,p.id,p.display_name,'qualification_evidence_added','crew',doc->>'targetId',doc);
 return doc;
end;$$;
revoke all on function public.aerolog_crew_attach(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_crew_attach(uuid,uuid,jsonb) to service_role;
