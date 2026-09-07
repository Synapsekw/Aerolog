-- Original equipment rows remain referenced; canonical identities are separate.
create table public.aerolog_equipment_aliases(
 organization_id uuid not null,kind text not null check(kind in ('asset','battery')),source_id text not null,canonical_id text not null,
 created_by uuid not null,created_at timestamptz not null default now(),
 primary key(organization_id,kind,source_id),check(source_id<>canonical_id),
 foreign key(organization_id,kind,source_id) references public.aerolog_records(organization_id,kind,id),
 foreign key(organization_id,kind,canonical_id) references public.aerolog_records(organization_id,kind,id)
);
alter table public.aerolog_equipment_aliases enable row level security;
create policy equipment_alias_read on public.aerolog_equipment_aliases for select to authenticated using(organization_id=public.aerolog_org());
revoke all on public.aerolog_equipment_aliases from anon,authenticated;
grant select on public.aerolog_equipment_aliases to authenticated;
create function public.aerolog_equipment_alias_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare current_id text;next_id text;seen text[];
begin
 if tg_op<>'INSERT' then raise exception 'Equipment identity history is immutable';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 current_id:=new.canonical_id;seen:=array[new.source_id];
 loop
  if current_id=any(seen) then raise exception 'Equipment identity cycle rejected';end if;
  seen:=array_append(seen,current_id);
  select canonical_id into next_id from public.aerolog_equipment_aliases where organization_id=new.organization_id and kind=new.kind and source_id=current_id;
  if next_id is null then exit;end if;current_id:=next_id;
 end loop;
 return new;
end;$$;
create trigger equipment_alias_guard before insert or update or delete on public.aerolog_equipment_aliases for each row execute function public.aerolog_equipment_alias_guard();
revoke all on function public.aerolog_equipment_alias_guard() from public,anon,authenticated;
