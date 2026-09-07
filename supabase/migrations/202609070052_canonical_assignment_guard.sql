-- Require explicit review of stale assignments; never rewrite frozen mission packages.
create function public.aerolog_canonical_assignment_guard() returns trigger language plpgsql set search_path='' as $$
declare source public.aerolog_records;alias public.aerolog_equipment_aliases;item jsonb;selected boolean;
begin
 if new.kind not in ('kit','mission','inspection_plan','service') then return new;end if;
 if new.kind='kit' and new.data->>'archived'='true' then return new;end if;
 if new.kind='mission' and new.data->>'status' not in ('Pending approval','Approved') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 for alias in select * from public.aerolog_equipment_aliases where organization_id=new.organization_id loop
  selected:=false;
  if new.kind in ('inspection_plan','service') then
   selected:=new.data->>'targetKind'=alias.kind and new.data->>'targetId'=alias.source_id;
  elsif new.kind='kit' then
   selected:=exists(select 1 from jsonb_array_elements(coalesce(new.data->'items','[]')) i where i->>'kind'=alias.kind and i->>'id'=alias.source_id);
  else
   select * into source from public.aerolog_records where organization_id=new.organization_id and kind=alias.kind and id=alias.source_id;
   selected:=(alias.kind='battery' and coalesce(new.data->'equipment','[]') ? alias.source_id)
    or (alias.kind='asset' and (source.data->>'name'=any(public.aerolog_mission_aircraft(new.data)) or coalesce(new.data->'equipment','[]') ? (source.data->>'name')))
    or exists(select 1 from jsonb_array_elements(coalesce(new.data->'kitSnapshots','[]')) snap cross join lateral jsonb_array_elements(coalesce(snap->'items','[]')) i where i->>'kind'=alias.kind and i->>'id'=alias.source_id);
  end if;
  if selected then raise exception 'Assignment contains merged source %. Select canonical equipment % and review the updated package.',alias.source_id,public.aerolog_canonical_equipment_id(new.organization_id,alias.kind,alias.source_id) using errcode='PT409';end if;
 end loop;
 return new;
end;$$;
create trigger zz_canonical_assignment_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_canonical_assignment_guard();
revoke all on function public.aerolog_canonical_assignment_guard() from public,anon,authenticated;
