-- Crew links take precedence over display names; ambiguous names are not attributed.
create or replace function public.aerolog_flight_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare pilot_id uuid; matches integer;
begin
 if new.kind='flight' then
  select m.user_id into pilot_id from public.aerolog_records c join public.aerolog_memberships m on m.organization_id=c.organization_id and m.user_id::text=c.data->>'authUserId'
   where c.organization_id=new.organization_id and c.kind='crew' and c.data->>'name'=new.data->>'pilot';
  if pilot_id is null then
   select count(*) into matches from public.aerolog_memberships where organization_id=new.organization_id and display_name=new.data->>'pilot';
   if matches=1 then select user_id into pilot_id from public.aerolog_memberships where organization_id=new.organization_id and display_name=new.data->>'pilot'; end if;
  end if;
  new.data:=new.data-'pilotUserId';
  if pilot_id is not null then new.data:=new.data||jsonb_build_object('pilotUserId',pilot_id); end if;
 end if;
 return new;
end;$$;
