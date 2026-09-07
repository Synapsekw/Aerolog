create function public.aerolog_merged_source_write_guard() returns trigger language plpgsql set search_path='' as $$
declare org uuid;k text;rid text;canonical text;
begin
 if tg_op in ('UPDATE','DELETE') and old.kind in ('asset','battery') then org:=old.organization_id;k:=old.kind;rid:=old.id;
 elsif tg_op='INSERT' and new.kind='battery_reading' then org:=new.organization_id;k:='battery';rid:=new.data->>'batteryId';
 end if;
 if rid is not null and exists(select 1 from public.aerolog_equipment_aliases where organization_id=org and kind=k and source_id=rid) then
  canonical:=public.aerolog_canonical_equipment_id(org,k,rid);
  raise exception 'This is a merged source record. Open canonical equipment % before editing or recording readings.',canonical using errcode='PT409';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger aerolog_merged_source_write_guard before insert or update or delete on public.aerolog_records for each row execute function public.aerolog_merged_source_write_guard();
revoke all on function public.aerolog_merged_source_write_guard() from public,anon,authenticated;
