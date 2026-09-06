create or replace function public.aerolog_link_source(actor uuid,expected_org uuid,source_id text,flight_ids text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; old public.aerolog_records; merged jsonb; doc jsonb; total integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.role not in ('admin','manager','pilot') then raise exception 'Import access required' using errcode='42501';end if;
 if p.organization_id<>expected_org then raise exception 'Organization changed. Refresh.' using errcode='PT409';end if;
 if cardinality(flight_ids)<1 or cardinality(flight_ids)>500 then raise exception 'Invalid flight links';end if;
 select count(*) into total from public.aerolog_records where organization_id=expected_org and kind='flight' and id=any(flight_ids) and (p.role<>'pilot' or created_by=actor);
 if total<>(select count(distinct value) from unnest(flight_ids) value) then raise exception 'Flight link unavailable' using errcode='42501';end if;
 select * into old from public.aerolog_records where organization_id=expected_org and kind='attachment' and id=source_id for update;
 if old.id is null or (old.data->>'source') is distinct from 'true' then raise exception 'Source archive not found';end if;
 select jsonb_agg(value order by value) into merged from (select distinct value from jsonb_array_elements_text(coalesce(old.data->'flights','[]'::jsonb)||to_jsonb(flight_ids))) links;
 doc=old.data||jsonb_build_object('flights',merged);
 if doc<>old.data then
  update public.aerolog_records set data=doc,revision=revision+1,updated_at=now() where organization_id=expected_org and kind='attachment' and id=source_id;
  insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data) values(expected_org,actor,p.display_name,'flight_source_links_updated','attachment',source_id,old.data,doc);
 end if;
 return doc;
end;$$;
revoke all on function public.aerolog_link_source(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.aerolog_link_source(uuid,uuid,text,text[]) to service_role;
