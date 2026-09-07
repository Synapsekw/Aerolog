create function public.aerolog_bulk_equipment_metadata(items jsonb, patch jsonb, expected_organization uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; item jsonb; record public.aerolog_records; field text; result jsonb:='[]';
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_organization::text,0));
 select * into p from public.aerolog_profiles where id=auth.uid() and active for update;
 if p.id is null or p.role not in ('admin','manager','technician') then raise exception 'Fleet management permission required' using errcode='42501';end if;
 if p.organization_id<>expected_organization then raise exception 'Organization changed. Refresh before saving.' using errcode='PT409';end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 100 or jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb then raise exception 'Select 1 to 100 items and metadata changes';end if;
 for field in select jsonb_object_keys(patch) loop
  if field not in ('manufacturer','productModel','firmware','storageSiteId') or jsonb_typeof(patch->field) is distinct from 'string' or length(patch->>field)>(case when field='productModel' then 120 else 100 end) then raise exception 'Unsupported bulk metadata field';end if;
 end loop;
 if (select count(*)<>count(distinct (i->>'kind',i->>'id')) from jsonb_array_elements(items) i) then raise exception 'Duplicate equipment selection';end if;
 for item in select * from jsonb_array_elements(items) loop
  if item->>'kind' is null or item->>'kind' not in ('asset','battery') then raise exception 'Equipment kind required';end if;
  select * into record from public.aerolog_records where organization_id=expected_organization and kind=item->>'kind' and id=item->>'id' for update;
  if record.id is null then raise exception 'Equipment not found in this organization';end if;
  if record.revision is distinct from (item->>'revision')::integer then raise exception 'Equipment changed. Refresh and review again.' using errcode='PT409';end if;
 end loop;
 for item in select * from jsonb_array_elements(items) loop
  select * into record from public.aerolog_records where organization_id=expected_organization and kind=item->>'kind' and id=item->>'id';
  result:=result||jsonb_build_array(public.aerolog_command('save',jsonb_build_object('kind',record.kind,'data',record.data||patch,'revision',record.revision)));
 end loop;
 return jsonb_build_object('updated',jsonb_array_length(items),'results',result);
end;$$;
revoke all on function public.aerolog_bulk_equipment_metadata(jsonb,jsonb,uuid) from public,anon;
grant execute on function public.aerolog_bulk_equipment_metadata(jsonb,jsonb,uuid) to authenticated;
