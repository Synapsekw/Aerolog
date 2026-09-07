create function public.aerolog_service_project_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare previous jsonb;project public.aerolog_records;project_id text;
begin
 if new.kind<>'service' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 if tg_op='UPDATE' then previous:=old.data;
 else select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='service' and id=new.id;end if;
 project_id:=nullif(new.data->>'projectId','');
 if project_id is null then new.data:=new.data-'projectSnapshot';return new;end if;
 if project_id=previous->>'projectId' and previous->'projectSnapshot' is not null then
   new.data:=jsonb_set(new.data,'{projectSnapshot}',previous->'projectSnapshot');return new;
 end if;
 select * into project from public.aerolog_records where organization_id=new.organization_id and kind='project' and id=project_id;
 if project.id is null or coalesce((project.data->>'archived')::boolean,false) then raise exception 'Choose an active project in this organization';end if;
 new.data:=jsonb_set(new.data,'{projectSnapshot}',jsonb_build_object('id',project.id,'name',project.data->>'name','reference',coalesce(project.data->>'reference',''),'revision',project.revision));
 return new;
end;$$;
create trigger aerolog_service_project before insert or update on public.aerolog_records for each row execute function public.aerolog_service_project_guard();
revoke all on function public.aerolog_service_project_guard() from public,anon,authenticated;
