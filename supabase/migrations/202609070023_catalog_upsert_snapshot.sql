create or replace function public.aerolog_mission_catalog_snapshot() returns trigger language plpgsql set search_path='' as $$
declare project public.aerolog_records;site public.aerolog_records;customer public.aerolog_records;snapshot jsonb:='{}';previous jsonb;
begin
 if new.kind<>'mission' then return new;end if;
 if TG_OP='INSERT' then select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='mission' and id=new.id;else previous:=old.data;end if;
 if previous->>'status' not in ('Draft','Changes requested') then new.data:=new.data||jsonb_build_object('projectId',coalesce(previous->>'projectId',''),'siteId',coalesce(previous->>'siteId',''),'contextSnapshot',coalesce(previous->'contextSnapshot','{}'));return new;end if;
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
