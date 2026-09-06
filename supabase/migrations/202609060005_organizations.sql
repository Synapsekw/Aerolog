-- Memberships retain access when a user changes their active organization.
alter table public.aerolog_organizations add column logo_data text;
create table public.aerolog_memberships (
 organization_id uuid references public.aerolog_organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 display_name text not null,
 role text not null check(role in ('admin','manager','pilot','technician','observer')),
 active boolean not null default true,
 primary key(organization_id,user_id)
);
insert into public.aerolog_memberships select organization_id,id,display_name,role,active from public.aerolog_profiles;
alter table public.aerolog_memberships enable row level security;
create policy membership_read on public.aerolog_memberships for select to authenticated using(user_id=auth.uid() or organization_id=public.aerolog_org());
grant select on public.aerolog_memberships to authenticated;
create function public.aerolog_keep_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.aerolog_memberships values(new.organization_id,new.id,new.display_name,new.role,new.active)
 on conflict(organization_id,user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
 return new;
end;$$;
create trigger membership_sync after insert or update on public.aerolog_profiles for each row execute function public.aerolog_keep_membership();
create table public.aerolog_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aerolog_organizations(id) on delete cascade,
 email text not null, role text not null check(role in ('admin','manager','pilot','technician','observer')),
 token_hash text unique not null, expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.aerolog_invitations enable row level security;
-- Only server routes create invitations; raw codes are never stored.
create function public.aerolog_organization(action text, payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); oid uuid; m public.aerolog_memberships; inv public.aerolog_invitations; label text; mail text;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select email into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before joining or creating an organization'; end if;
 select display_name into label from public.aerolog_profiles where id=uid;
 label:=coalesce(nullif(trim(payload->>'displayName'),''),label,split_part(mail,'@',1));
 if length(label)>100 then raise exception 'Name is too long'; end if;
 if action='create' then
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 100 then raise exception 'Organization name required (100 characters maximum)'; end if;
  insert into public.aerolog_organizations(name) values(trim(payload->>'name')) returning id into oid;
  insert into public.aerolog_memberships values(oid,uid,label,'admin',true);
 elsif action='join' then
  select * into inv from public.aerolog_invitations where token_hash=payload->>'tokenHash' for update;
  if inv.id is null or inv.accepted_by is not null or inv.expires_at<now() or lower(inv.email)<>lower(mail) then raise exception 'Invitation is invalid, expired, used, or belongs to another email'; end if;
  oid:=inv.organization_id;
  if exists(select 1 from public.aerolog_memberships where organization_id=oid and user_id=uid) then raise exception 'Already a member; ask your administrator to restore disabled access'; end if;
  insert into public.aerolog_memberships values(oid,uid,label,inv.role,true);
  update public.aerolog_invitations set accepted_by=uid where id=inv.id;
 elsif action='switch' then oid:=(payload->>'id')::uuid;
 else raise exception 'Unknown organization action'; end if;
 select * into m from public.aerolog_memberships where organization_id=oid and user_id=uid and active;
 if m.user_id is null then raise exception 'Active membership required'; end if;
 insert into public.aerolog_profiles(id,organization_id,display_name,role,active) values(uid,oid,m.display_name,m.role,true)
 on conflict(id) do update set organization_id=excluded.organization_id,display_name=excluded.display_name,role=excluded.role,active=true;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id) values(oid,uid,m.display_name,'organization_'||action,'organization',oid::text);
 return oid;
end;$$;
revoke all on function public.aerolog_organization(text,jsonb) from public,anon;
grant execute on function public.aerolog_organization(text,jsonb) to authenticated;
create or replace function public.aerolog_access(target uuid,new_role text,enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; t public.aerolog_memberships;
begin
 select * into p from public.aerolog_profiles where id=auth.uid() and active and role='admin';
 if p.id is null then raise exception 'Administrator role required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.organization_id::text,0));
 if target=p.id then raise exception 'Cannot alter your own workspace access'; end if;
 if new_role not in ('admin','manager','pilot','technician','observer') or enabled is null then raise exception 'Invalid access policy'; end if;
 select * into t from public.aerolog_memberships where organization_id=p.organization_id and user_id=target for update;
 if t.user_id is null then raise exception 'Account not found'; end if;
 if t.role='admin' and t.active and (not enabled or new_role<>'admin') and (select count(*) from public.aerolog_memberships where organization_id=p.organization_id and role='admin' and active)<=1 then raise exception 'An organization needs an active administrator'; end if;
 update public.aerolog_memberships set role=new_role,active=enabled where organization_id=p.organization_id and user_id=target;
 update public.aerolog_profiles set role=new_role,active=enabled where organization_id=p.organization_id and id=target;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id) values(p.organization_id,p.id,p.display_name,'access_updated','profile',target::text);
end;$$;
-- Persist a stable pilot identity on newly recorded flights, including imports.
create function public.aerolog_flight_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare pilot_id uuid;
begin
 if new.kind='flight' then
  select user_id into pilot_id from public.aerolog_memberships where organization_id=new.organization_id and display_name=new.data->>'pilot' order by user_id limit 1;
  new.data:=new.data-'pilotUserId';
  if pilot_id is not null then new.data:=new.data||jsonb_build_object('pilotUserId',pilot_id); end if;
 end if;
 return new;
end;$$;
create trigger flight_identity before insert on public.aerolog_records for each row execute function public.aerolog_flight_identity();
