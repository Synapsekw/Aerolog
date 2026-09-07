alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event','battery_reading','customer','project','site','form_template','incident'));
create function public.aerolog_incident_write(actor uuid,expected_org uuid,document jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;previous public.aerolog_records;doc jsonb:=document;item jsonb;field text;related text;actions jsonb:='[]';prior_action jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org then raise exception 'Active organization member required' using errcode='42501';end if;
 select * into previous from public.aerolog_records where organization_id=expected_org and kind='incident' and id=doc->>'id' for update;
 if coalesce(previous.revision,0)<>expected_revision then raise exception 'Incident changed. Refresh before saving.' using errcode='PT409';end if;
 if p.role not in ('admin','manager') and (doc->>'status'<>'Reported' or (previous.id is not null and (previous.created_by<>actor or previous.data->>'status'<>'Reported'))) then raise exception 'Only managers can investigate or close incidents; reporters can edit their own reports' using errcode='42501';end if;
 if (doc->>'occurredAt')::timestamptz>now()+interval '1 minute' then raise exception 'Incident date cannot be in the future';end if;
 foreach field in array array['flightId','projectId','siteId'] loop
  related:=case field when 'flightId' then 'flight' when 'projectId' then 'project' else 'site' end;
  if coalesce(doc->>field,'')<>'' and not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=related and id=doc->>field) then raise exception 'Linked % not found in this organization',related;end if;
 end loop;
 for item in select value from jsonb_array_elements(doc->'equipment') loop
  if not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=item->>'kind' and kind in ('asset','battery') and id=item->>'id') then raise exception 'Equipment not found in this organization';end if;
 end loop;
 for item in select value from jsonb_array_elements(doc->'personnelIds') loop
  if not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='crew' and id=item#>>'{}') then raise exception 'Personnel not found in this organization';end if;
 end loop;
 if doc->>'status'='Closed' and (length(btrim(doc->>'resolution'))<10 or exists(select 1 from jsonb_array_elements(doc->'actions') a where a->>'done' is distinct from 'true')) then raise exception 'Finish actions and record a resolution before closure';end if;
 for item in select value from jsonb_array_elements(doc->'actions') loop
  select value into prior_action from jsonb_array_elements(coalesce(previous.data->'actions','[]')) where value->>'id'=item->>'id';
  if coalesce(item->>'assignedTo','')<>'' and item->>'assignedTo' is distinct from prior_action->>'assignedTo' and not exists(select 1 from public.aerolog_memberships where organization_id=expected_org and user_id::text=item->>'assignedTo' and active) then raise exception 'Choose an active organization member for this action';end if;
  if item->>'done'='true' then
   if length(btrim(item->>'completionNotes'))<5 then raise exception 'Completion notes required';end if;
   if prior_action->>'done'='true' and prior_action->>'completionNotes'=item->>'completionNotes' and prior_action->>'task'=item->>'task' then item:=item||jsonb_build_object('completedBy',prior_action->'completedBy','completedAt',prior_action->'completedAt');else item:=item||jsonb_build_object('completedBy',p.display_name,'completedAt',now());end if;
  end if;
  actions:=actions||jsonb_build_array(item);
 end loop;
 doc:=doc||jsonb_build_object('actions',actions,'reportedBy',coalesce(previous.data->>'reportedBy',p.display_name),'reportedById',coalesce(previous.data->>'reportedById',p.id::text),'reportedAt',coalesce(previous.data->'reportedAt',to_jsonb(now())),'updatedBy',p.display_name);
 if doc->>'status'='Closed' then doc:=doc||jsonb_build_object('closedBy',p.display_name,'closedAt',now());end if;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by)values(expected_org,'incident',doc->>'id',doc,expected_revision+1,coalesce(previous.created_by,p.id))on conflict(organization_id,kind,id)do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,p.id,p.display_name,'incident_saved','incident',doc->>'id',previous.data,doc);
 return doc;
end;$$;
revoke all on function public.aerolog_incident_write(uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.aerolog_incident_write(uuid,uuid,jsonb,integer) to service_role;
create function public.aerolog_incident_attach(actor uuid,expected_org uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;incident public.aerolog_records;doc jsonb:=document;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org then raise exception 'Active organization member required' using errcode='42501';end if;
 select * into incident from public.aerolog_records where organization_id=expected_org and kind='incident' and id=doc->>'targetId';
 if incident.id is null then raise exception 'Incident not found';end if;
 if incident.data->>'status'='Closed' or (p.role not in ('admin','manager') and incident.created_by<>actor) then raise exception 'Evidence requires an open incident you can edit' using errcode='42501';end if;
 if doc->>'targetKind'<>'incident' or doc->>'path' is distinct from expected_org::text||'/incidents/'||(doc->>'id') then raise exception 'Invalid incident attachment path';end if;
 doc:=doc||jsonb_build_object('uploadedBy',p.display_name,'uploadedAt',now());
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'attachment',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,p.id,p.display_name,'incident_evidence_added','incident',incident.id,doc);
 return doc;
end;$$;
revoke all on function public.aerolog_incident_attach(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_incident_attach(uuid,uuid,jsonb) to service_role;
