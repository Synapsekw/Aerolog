alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event','battery_reading','customer','project','site'));
create function public.aerolog_catalog_write(actor uuid,expected_org uuid,record_kind text,document jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;old public.aerolog_records;reference text;related_kind text;doc jsonb:=document;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Active organization manager required' using errcode='42501';end if;
 if record_kind not in ('customer','project','site') then raise exception 'Invalid catalog kind';end if;
 select * into old from public.aerolog_records where organization_id=expected_org and kind=record_kind and id=doc->>'id' for update;
 if coalesce(old.revision,0)<>expected_revision then raise exception 'Record changed. Refresh before saving.' using errcode='PT409';end if;
 related_kind:=case record_kind when 'project' then 'customer' when 'site' then 'project' end;reference:=case record_kind when 'project' then doc->>'customerId' when 'site' then doc->>'projectId' end;
 if coalesce(reference,'')<>'' and not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=related_kind and id=reference) then raise exception 'Related record not found in this organization';end if;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by)values(expected_org,record_kind,doc->>'id',doc,coalesce(old.revision,0)+1,p.id)on conflict(organization_id,kind,id)do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,p.id,p.display_name,'catalog_saved',record_kind,doc->>'id',old.data,doc);
 return doc;
end;$$;
revoke all on function public.aerolog_catalog_write(uuid,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.aerolog_catalog_write(uuid,uuid,text,jsonb,integer) to service_role;
create function public.aerolog_mission_catalog_snapshot() returns trigger language plpgsql set search_path='' as $$
declare project public.aerolog_records;site public.aerolog_records;customer public.aerolog_records;snapshot jsonb:='{}';
begin
 if new.kind<>'mission' then return new;end if;
 if TG_OP='UPDATE' and old.data->>'status' not in ('Draft','Changes requested') then new.data:=new.data||jsonb_build_object('projectId',coalesce(old.data->>'projectId',''),'siteId',coalesce(old.data->>'siteId',''),'contextSnapshot',coalesce(old.data->'contextSnapshot','{}'));return new;end if;
 if coalesce(new.data->>'projectId','')<>'' then
  select * into project from public.aerolog_records where organization_id=new.organization_id and kind='project' and id=new.data->>'projectId';
  if project.id is null or project.data->>'archived'='true' then raise exception 'Choose an active project in this organization';end if;
  select * into customer from public.aerolog_records where organization_id=new.organization_id and kind='customer' and id=project.data->>'customerId';
  snapshot:=snapshot||jsonb_build_object('project',jsonb_build_object('id',project.id,'name',project.data->>'name','revision',project.revision),'customer',case when customer.id is null then null else jsonb_build_object('id',customer.id,'name',customer.data->>'name','revision',customer.revision)end);
 end if;
 if coalesce(new.data->>'siteId','')<>'' then
  select * into site from public.aerolog_records where organization_id=new.organization_id and kind='site' and id=new.data->>'siteId';
  if site.id is null or site.data->>'archived'='true' or site.data->>'purpose'='Storage' then raise exception 'Choose an active operating site';end if;
  if coalesce(site.data->>'projectId','')<>'' and site.data->>'projectId' is distinct from new.data->>'projectId' then raise exception 'Site belongs to a different project';end if;
  snapshot:=snapshot||jsonb_build_object('site',jsonb_build_object('id',site.id,'name',site.data->>'name','revision',site.revision,'address',site.data->>'address','geometry',site.data->'geometry'));
 end if;
 new.data:=new.data||jsonb_build_object('contextSnapshot',snapshot);return new;
end;$$;
create trigger mission_catalog_snapshot before insert or update on public.aerolog_records for each row execute function public.aerolog_mission_catalog_snapshot();
