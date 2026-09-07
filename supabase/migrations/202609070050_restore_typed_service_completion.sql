-- Repair the service path overwritten by migration 049 while retaining canonical flight routing.
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
 if position(new_lookup in definition)>0 and position(new_update in definition)>0 then return;end if;
 if position(old_lookup in definition)=0 or position(old_update in definition)=0 then raise exception 'Expected service implementation not found';end if;
 execute replace(replace(definition,old_lookup,new_lookup),old_update,new_update);
end;$$;
