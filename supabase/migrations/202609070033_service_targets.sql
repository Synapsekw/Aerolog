create function public.aerolog_service_target_guard() returns trigger
language plpgsql set search_path='' as $$
declare target public.aerolog_records; n integer;
begin
 if new.kind<>'service' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 if nullif(new.data->>'targetId','') is null and nullif(new.data->>'targetKind','') is null then
   select count(*) into n from public.aerolog_records where organization_id=new.organization_id and kind='asset' and data->>'name'=new.data->>'asset';
   if n<>1 then raise exception 'Select one equipment record for this work order';end if;
   select * into target from public.aerolog_records where organization_id=new.organization_id and kind='asset' and data->>'name'=new.data->>'asset';
 else
   if coalesce(new.data->>'targetKind','') not in ('asset','battery') then raise exception 'Invalid work order equipment type';end if;
   select * into target from public.aerolog_records where organization_id=new.organization_id and kind=new.data->>'targetKind' and id=new.data->>'targetId';
 end if;
 if target.id is null then raise exception 'Work order equipment not found in this organization';end if;
 new.data:=new.data||jsonb_build_object('targetKind',target.kind,'targetId',target.id,'asset',coalesce(target.data->>'name',target.data->>'sourceName',target.data->>'model',target.id));
 return new;
end;$$;
create trigger aerolog_service_target_guard before insert or update on public.aerolog_records
for each row execute function public.aerolog_service_target_guard();
-- Preserve all existing command logic while replacing the name-only service path.
do $$
declare definition text; old_lookup text; new_lookup text; old_update text; new_update text;
begin
 definition:=pg_get_functiondef('public.aerolog_command_internal(text,jsonb)'::regprocedure);
 old_lookup:=$old$select * into a from public.aerolog_records where organization_id=p.organization_id and kind='asset' and data->>'name'=o.data->>'asset' for update;$old$;
 new_lookup:=$new$select * into a from public.aerolog_records where organization_id=p.organization_id and (case when nullif(o.data->>'targetId','') is not null then kind=o.data->>'targetKind' and id=o.data->>'targetId' else kind='asset' and data->>'name'=o.data->>'asset' end) for update;$new$;
 old_update:=$old$update public.aerolog_records set data=data || jsonb_build_object('status','Available','next',(data->>'hours')::numeric+coalesce((o.data->>'intervalHours')::numeric,100)),revision=revision+1,updated_at=now() where organization_id=p.organization_id and kind='asset' and id=a.id;$old$;
 new_update:=$new$if a.kind='asset' then
   if nullif(a.data->>'hours','') is null then raise exception 'Record equipment hours before resetting the service interval';end if;
   update public.aerolog_records set data=data || jsonb_build_object('status',case when data->>'status' in ('Retired','Checked out') then data->>'status' else 'Available' end,'next',(data->>'hours')::numeric+coalesce((o.data->>'intervalHours')::numeric,100)),revision=revision+1,updated_at=now() where organization_id=p.organization_id and kind='asset' and id=a.id;
  end if;$new$;
 if position(old_lookup in definition)=0 or position(old_update in definition)=0 then raise exception 'Expected service implementation not found';end if;
 execute replace(replace(definition,old_lookup,new_lookup),old_update,new_update);
end;$$;
