-- Preserve stable personnel identity when an organization member is onboarded.
create function public.aerolog_crew_membership_guard() returns trigger
language plpgsql set search_path='' as $$
declare previous jsonb; member_name text; linked_id text;
begin
 if new.kind <> 'crew' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 select data into previous from public.aerolog_records
 where organization_id=new.organization_id and kind='crew' and id=new.id;
 linked_id:=nullif(new.data->>'authUserId','');
 if nullif(previous->>'authUserId','') is not null and
    previous->>'authUserId' is distinct from linked_id then
   raise exception 'An existing crew membership link cannot be reassigned';
 end if;
 if linked_id is null then return new; end if;
 -- An unchanged historical link remains editable after membership removal.
 if previous->>'authUserId' is distinct from linked_id then
   select display_name into member_name from public.aerolog_memberships
   where organization_id=new.organization_id and user_id::text=linked_id and active;
   if member_name is null then raise exception 'Choose an active member of this organization'; end if;
   if new.data->>'name' is distinct from member_name then
     raise exception 'Crew name must match the linked member';
   end if;
 end if;
 if exists(select 1 from public.aerolog_records where organization_id=new.organization_id
   and kind='crew' and id<>new.id and data->>'authUserId'=linked_id) then
   raise exception 'This member already has a crew profile';
 end if;
 return new;
end;$$;
create trigger aerolog_crew_membership_guard before insert or update on public.aerolog_records
for each row execute function public.aerolog_crew_membership_guard();
