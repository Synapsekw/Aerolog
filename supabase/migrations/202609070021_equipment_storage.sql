create or replace function public.aerolog_equipment_metadata_guard() returns trigger language plpgsql set search_path='' as $$
declare site public.aerolog_records;field text;value numeric;previous_storage text;
begin
 if new.kind not in ('asset','battery') then return new;end if;
 if coalesce(new.data->>'storageSiteId','')<>'' then
  select * into site from public.aerolog_records where organization_id=new.organization_id and kind='site' and id=new.data->>'storageSiteId';
  if site.id is null then raise exception 'Storage site not found in this organization';end if;
  if TG_OP='INSERT' then
   select data->>'storageSiteId' into previous_storage from public.aerolog_records where organization_id=new.organization_id and kind=new.kind and id=new.id;
  else previous_storage:=old.data->>'storageSiteId';end if;
  if new.data->>'storageSiteId' is distinct from previous_storage then
   if site.data->>'archived'='true' or site.data->>'purpose' not in ('Storage','Both') then raise exception 'Choose an active storage site';end if;
  end if;
 end if;
 foreach field in array array['manufacturer','productModel','firmware','storageSiteId'] loop
  if new.data ? field and (jsonb_typeof(new.data->field) is distinct from 'string' or length(new.data->>field)>120) then raise exception 'Invalid equipment field %',field;end if;
 end loop;
 if new.kind='battery' then
  foreach field in array array['ratedCapacityMah','nominalVoltage'] loop
   if new.data ? field and new.data->field<>'null'::jsonb then
    if jsonb_typeof(new.data->field) is distinct from 'number' then raise exception 'Numeric % required',field;end if;
    value:=(new.data->>field)::numeric;
    if value<=0 or (field='ratedCapacityMah' and value>1000000) or (field='nominalVoltage' and value>1000) then raise exception 'Invalid %',field;end if;
   end if;
  end loop;
 end if;
 return new;
end;$$;
create trigger equipment_metadata_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_equipment_metadata_guard();
