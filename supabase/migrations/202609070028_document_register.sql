alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event','battery_reading','customer','project','site','form_template','incident','document','document_revision'));
create or replace function public.aerolog_document_write(actor uuid,expected_org uuid,request jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;previous public.aerolog_records;doc jsonb;rid text;revision integer;rules jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Active organization manager required' using errcode='42501';end if;
 rid:=case when request->>'action'='save' then request->'data'->>'id' else request->>'id' end;
 select * into previous from public.aerolog_records where organization_id=expected_org and kind='document' and id=rid for update;
 if coalesce(previous.revision,0)<>(request->>'revision')::integer then raise exception 'Document changed. Refresh before continuing.' using errcode='PT409';end if;
 if request->>'action'='save' then
  doc:=request->'data';
  if doc->>'targetKind'<>'Organization' and not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=doc->>'targetKind' and id=doc->>'targetId') then raise exception 'Linked entity not found in this organization';end if;
  if coalesce(doc->>'attachmentId','')<>'' and not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='attachment' and id=doc->>'attachmentId' and data->>'targetKind'='document' and data->>'targetId'=rid) then raise exception 'Choose a file attached to this document';end if;
  if request->>'submit'='true' and (coalesce(doc->>'attachmentId','')='' or doc->>'archived'='true') then raise exception 'An active document with a file is required for review';end if;
  doc:=doc||jsonb_build_object('status',case when request->>'submit'='true' then 'Pending approval' else 'Draft' end,'submittedById',p.id,'submittedBy',p.display_name);
 else
  if previous.id is null or previous.data->>'status'<>'Pending approval' then raise exception 'Document is not awaiting review';end if;
  select settings into rules from public.aerolog_organizations where id=expected_org;
  if not coalesce((rules->>'allowSelfApproval')::boolean,false) and previous.data->>'submittedById'=p.id::text then raise exception 'A different operations manager must review this document';end if;
  doc:=previous.data||jsonb_build_object('status',request->>'decision','reviewNote',request->>'note','reviewedBy',p.display_name,'reviewedAt',now());
 end if;
 revision:=coalesce(previous.revision,0)+1;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by)values(expected_org,'document',rid,doc,revision,coalesce(previous.created_by,p.id))on conflict(organization_id,kind,id)do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'document_revision',rid||':'||revision,doc||jsonb_build_object('id',rid||':'||revision,'documentId',rid,'revision',revision,'recordedAt',now(),'recordedBy',p.display_name),p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,p.id,p.display_name,'document_'||(request->>'action'),'document',rid,previous.data,doc);
 return doc;
end;$$;
revoke all on function public.aerolog_document_write(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_document_write(uuid,uuid,jsonb) to service_role;
create function public.aerolog_document_attach(actor uuid,expected_org uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;doc jsonb:=document;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Active organization manager required' using errcode='42501';end if;
 if doc->>'targetKind'<>'document' or not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='document' and id=doc->>'targetId') then raise exception 'Document not found';end if;
 if doc->>'path' is distinct from expected_org::text||'/documents/'||(doc->>'id') then raise exception 'Invalid document attachment path';end if;
 doc:=doc||jsonb_build_object('uploadedBy',p.display_name,'uploadedAt',now());
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'attachment',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,p.id,p.display_name,'document_file_added','document',doc->>'targetId',doc);return doc;
end;$$;
revoke all on function public.aerolog_document_attach(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_document_attach(uuid,uuid,jsonb) to service_role;
create function public.aerolog_mission_documents_guard() returns trigger language plpgsql set search_path='' as $$
declare previous jsonb;choice jsonb;document public.aerolog_records;snapshots jsonb:='[]';seen text[]:='{}';snapshot jsonb;
begin
 if new.kind<>'mission' then return new;end if;
 if TG_OP='INSERT' then select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='mission' and id=new.id;else previous:=old.data;end if;
 if previous->>'status' not in ('Draft','Changes requested') then new.data:=new.data||jsonb_build_object('documentSelections',coalesce(previous->'documentSelections','[]'),'documentSnapshots',coalesce(previous->'documentSnapshots','[]'));return new;end if;
 if jsonb_typeof(coalesce(new.data->'documentSelections','[]'))<>'array' or jsonb_array_length(coalesce(new.data->'documentSelections','[]'))>50 then raise exception 'Invalid document selection';end if;
 for choice in select value from jsonb_array_elements(coalesce(new.data->'documentSelections','[]')) loop
  if choice->>'id'=any(seen) then raise exception 'Document selected twice';end if;seen:=array_append(seen,choice->>'id');
  select * into document from public.aerolog_records where organization_id=new.organization_id and kind='document' and id=choice->>'id';
  if document.id is null or document.data->>'archived'='true' then raise exception 'Choose an active document in this organization';end if;
  if document.revision::text is distinct from choice->>'revision' then raise exception 'Document changed. Review and select its current version.' using errcode='PT409';end if;
  if new.data->>'status' in ('Pending approval','Approved') and (document.data->>'status'<>'Approved' or nullif(document.data->>'validFrom','')::date>(new.data->>'date')::date or nullif(document.data->>'expires','')::date<(new.data->>'date')::date) then raise exception 'Document % needs approval or is invalid on the mission date',document.data->>'name';end if;
  if document.data->>'targetKind'='mission' and document.data->>'targetId'<>new.id or document.data->>'targetKind'='project' and document.data->>'targetId' is distinct from new.data->>'projectId' then raise exception 'Document does not apply to this mission or project';end if;
  if document.data->>'targetKind'='crew' and not exists(select 1 from public.aerolog_records where organization_id=new.organization_id and kind='crew' and id=document.data->>'targetId' and data->>'name'=any(public.aerolog_mission_people(new.data))) then raise exception 'Document does not apply to the assigned personnel';end if;
  if document.data->>'targetKind'='battery' and not coalesce(new.data->'equipment','[]') ? (document.data->>'targetId') then raise exception 'Document does not apply to the selected battery';end if;
  if document.data->>'targetKind'='asset' and not exists(select 1 from public.aerolog_records where organization_id=new.organization_id and kind='asset' and id=document.data->>'targetId' and (data->>'name'=any(public.aerolog_mission_aircraft(new.data)) or coalesce(new.data->'equipment','[]') ? (data->>'name'))) then raise exception 'Document does not apply to the selected equipment';end if;
  snapshot:=document.data||jsonb_build_object('revision',document.revision,'capturedAt',now());snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 new.data:=new.data||jsonb_build_object('documentSnapshots',snapshots);return new;
end;$$;
create trigger mission_documents_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_mission_documents_guard();
