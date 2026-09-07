-- Reusable, organization-scoped inventory kits. No item/flight mutation.
alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit'));
create function public.aerolog_save_kit(document jsonb, expected_revision integer, expected_organization uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; old public.aerolog_records; item jsonb; org uuid; next_revision integer;
begin
 select organization_id into org from public.aerolog_profiles where id=auth.uid() and active;
 if org is null then raise exception 'Active membership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into p from public.aerolog_profiles where id=auth.uid() and active for update;
 if p.id is null or p.role not in ('admin','manager','technician') then raise exception 'Fleet management permission required' using errcode='42501'; end if;
 if p.organization_id<>org or org<>expected_organization then raise exception 'Organization changed. Refresh before saving.' using errcode='PT409'; end if;
 if jsonb_typeof(document)<>'object' or coalesce(length(document->>'id'),0) not between 1 and 100 or coalesce(length(trim(document->>'name')),0) not between 1 and 160 or jsonb_typeof(document->'items') is distinct from 'array' then raise exception 'Invalid kit'; end if;
 if jsonb_array_length(document->'items') not between 1 and 100 or jsonb_typeof(document->'archived') is distinct from 'boolean' or expected_revision is null or expected_revision<0 then raise exception 'Invalid kit'; end if;
 if (select count(*)<>count(distinct (i->>'kind',i->>'id')) from jsonb_array_elements(document->'items') i) then raise exception 'Duplicate kit items'; end if;
 for item in select * from jsonb_array_elements(document->'items') loop
  if item->>'kind' not in ('asset','battery') or not exists(select 1 from public.aerolog_records where organization_id=org and kind=item->>'kind' and id=item->>'id') then raise exception 'Kit item not found in this organization'; end if;
 end loop;
 select * into old from public.aerolog_records where organization_id=org and kind='kit' and id=document->>'id' for update;
 if coalesce(old.revision,0)<>expected_revision then raise exception 'Kit changed. Refresh before saving.' using errcode='PT409'; end if;
 next_revision:=coalesce(old.revision,0)+1;
 insert into public.aerolog_records(organization_id,kind,id,data,revision,created_by) values(org,'kit',document->>'id',document,next_revision,p.id)
 on conflict(organization_id,kind,id) do update set data=excluded.data,revision=excluded.revision,updated_at=now();
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data) values(org,p.id,p.display_name,'kit_saved','kit',document->>'id',old.data,document);
 return jsonb_build_object('id',document->>'id','revision',next_revision);
end;$$;
revoke all on function public.aerolog_save_kit(jsonb,integer,uuid) from public,anon;
grant execute on function public.aerolog_save_kit(jsonb,integer,uuid) to authenticated;
