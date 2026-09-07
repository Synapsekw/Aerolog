alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event','battery_reading','customer','project','site','form_template'));
create function public.aerolog_form_template_write(actor uuid,expected_org uuid,document jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;previous public.aerolog_records;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Active organization manager required' using errcode='42501';end if;
 select * into previous from public.aerolog_records where organization_id=expected_org and kind='form_template' and id=document->>'id' for update;
 if coalesce(previous.revision,0)<>expected_revision then raise exception 'Template changed. Refresh before saving.' using errcode='PT409';end if;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by)values(expected_org,'form_template',document->>'id',document,expected_revision+1,actor)on conflict(organization_id,kind,id)do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,actor,p.display_name,'template_saved','form_template',document->>'id',previous.data,document);
 return document;
end;$$;
revoke all on function public.aerolog_form_template_write(uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.aerolog_form_template_write(uuid,uuid,jsonb,integer) to service_role;
create or replace function public.aerolog_mission_forms_guard() returns trigger language plpgsql set search_path='' as $$
declare previous jsonb;selection jsonb;snapshot jsonb;template public.aerolog_records;snapshots jsonb:='[]';field jsonb;answer jsonb;seen text[]:='{}';
begin
 if new.kind<>'mission' then return new;end if;
 if TG_OP='INSERT' then select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='mission' and id=new.id;else previous:=old.data;end if;
 if previous->>'status' not in ('Draft','Changes requested') then
  new.data:=new.data||jsonb_build_object('forms',coalesce(previous->'forms','[]'),'formSnapshots',coalesce(previous->'formSnapshots','[]'));return new;
 end if;
 if jsonb_typeof(coalesce(new.data->'forms','[]'))<>'array' or jsonb_array_length(coalesce(new.data->'forms','[]'))>20 then raise exception 'Invalid mission forms';end if;
 for selection in select value from jsonb_array_elements(coalesce(new.data->'forms','[]')) loop
  if selection->>'templateId'=any(seen) then raise exception 'Template already attached';end if;seen:=array_append(seen,selection->>'templateId');
  select value into snapshot from jsonb_array_elements(coalesce(previous->'formSnapshots','[]')) where value->>'id'=selection->>'templateId' and value->>'revision'=selection->>'revision';
  if snapshot is null then
   select * into template from public.aerolog_records where organization_id=new.organization_id and kind='form_template' and id=selection->>'templateId';
   if template.id is null or template.data->>'archived'='true' then raise exception 'Choose an active form template in this organization';end if;
   if template.revision::text is distinct from selection->>'revision' then raise exception 'Template changed. Select its current version.' using errcode='PT409';end if;
   snapshot:=template.data||jsonb_build_object('revision',template.revision,'capturedAt',now());
  end if;
  if jsonb_typeof(selection->'answers') is distinct from 'object' then raise exception 'Form answers must be an object';end if;
  for field in select value from jsonb_array_elements(snapshot->'fields') loop
   answer:=selection->'answers'->(field->>'id');
   if new.data->>'status' in ('Pending approval','Approved') and field->>'required'='true' and (answer is null or answer='null'::jsonb or answer='""'::jsonb or (jsonb_typeof(answer)='string' and btrim(answer#>>'{}')='') or (field->>'type'='Check' and answer<>'true'::jsonb)) then raise exception 'Complete required form field: %',field->>'label';end if;
   if answer is not null and answer<>'""'::jsonb then
    if field->>'type'='Check' and jsonb_typeof(answer)<>'boolean' or field->>'type'='Number' and jsonb_typeof(answer)<>'number' or field->>'type' in ('Text','Choice','Date') and jsonb_typeof(answer)<>'string' then raise exception 'Invalid form answer type: %',field->>'label';end if;
    if field->>'type'='Choice' and not (field->'options') ? (answer#>>'{}') then raise exception 'Invalid form choice';end if;
    if field->>'type'='Date' then perform (answer#>>'{}')::date;end if;
   end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(selection->'answers') k where not exists(select 1 from jsonb_array_elements(snapshot->'fields') f where f->>'id'=k)) then raise exception 'Unknown form field';end if;
  snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 new.data:=new.data||jsonb_build_object('formSnapshots',snapshots);return new;
end;$$;
create trigger mission_forms_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_mission_forms_guard();
