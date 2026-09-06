-- Serialize an operational write with workspace switches on the same account.
alter function public.aerolog_command(text,jsonb) rename to aerolog_command_internal;
revoke execute on function public.aerolog_command_internal(text,jsonb) from authenticated,anon,public;
create function public.aerolog_command(command text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;
begin
 select * into p from public.aerolog_profiles where id=auth.uid() and active for update;
 if p.id is null then raise exception 'Active membership required' using errcode='42501'; end if;
 if payload ? '_organizationId' and payload->>'_organizationId'<>p.organization_id::text then raise exception 'The active organization changed. Refresh before saving.' using errcode='PT409'; end if;
 return public.aerolog_command_internal(command,payload-'_organizationId');
end;$$;
revoke all on function public.aerolog_command(text,jsonb) from public,anon;
grant execute on function public.aerolog_command(text,jsonb) to authenticated;
