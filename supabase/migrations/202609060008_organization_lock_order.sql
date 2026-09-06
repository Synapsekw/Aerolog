create or replace function public.aerolog_command(command text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; expected_org uuid;
begin
 select organization_id into expected_org from public.aerolog_profiles where id=auth.uid() and active;
 if expected_org is null then raise exception 'Active membership required' using errcode='42501'; end if;
 -- Match the existing access and command lock order: organization, then profile.
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=auth.uid() and active for update;
 if p.id is null then raise exception 'Active membership required' using errcode='42501'; end if;
 if p.organization_id<>expected_org or (payload ? '_organizationId' and payload->>'_organizationId'<>p.organization_id::text) then raise exception 'The active organization changed. Refresh before saving.' using errcode='PT409'; end if;
 return public.aerolog_command_internal(command,payload-'_organizationId');
end;$$;
