-- Current mission/crew selection uses names. Disambiguate names within each team
-- so one pilot cannot accidentally log against another pilot's crew record.
create unique index aerolog_member_name on public.aerolog_memberships(organization_id,lower(display_name));
