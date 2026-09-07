create table public.aerolog_equipment_shares(
 id uuid primary key,owner_org uuid not null references public.aerolog_organizations(id),recipient_org uuid not null references public.aerolog_organizations(id),
 kind text not null check(kind in ('asset','battery')),equipment_id text not null,created_by uuid not null,created_at timestamptz not null default now(),expires_at timestamptz not null,
 status text not null default 'Pending' check(status in ('Pending','Accepted','Declined','Revoked')),accepted_by uuid,accepted_at timestamptz,
 check(owner_org<>recipient_org)
);
alter table public.aerolog_equipment_shares enable row level security;
revoke all on public.aerolog_equipment_shares from anon,authenticated;
create function public.aerolog_equipment_share(actor uuid,expected_org uuid,action text,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;s public.aerolog_equipment_shares;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Organization manager required' using errcode='42501';end if;
 if action='create' then
  if (document->>'expiresAt')::timestamptz<=now() or (document->>'expiresAt')::timestamptz>now()+interval '366 days' then raise exception 'Expiry must be within one year';end if;
  if not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=document->>'kind' and id=document->>'equipmentId') then raise exception 'Owned equipment not found';end if;
  insert into public.aerolog_equipment_shares(id,owner_org,recipient_org,kind,equipment_id,created_by,expires_at)values((document->>'id')::uuid,expected_org,(document->>'recipientOrg')::uuid,document->>'kind',document->>'equipmentId',actor,(document->>'expiresAt')::timestamptz) returning * into s;
 else
  select * into s from public.aerolog_equipment_shares where id=(document->>'id')::uuid and (owner_org=expected_org or recipient_org=expected_org) for update;
  if s.id is null then raise exception 'Equipment share not found';end if;
  if action='revoke' and s.owner_org=expected_org then update public.aerolog_equipment_shares set status='Revoked' where id=s.id returning * into s;
  elsif action in ('accept','decline') and s.recipient_org=expected_org and s.status='Pending' and s.expires_at>now() then
   if not exists(select 1 from public.aerolog_memberships where organization_id=s.owner_org and user_id=s.created_by and active and role in ('admin','manager')) then raise exception 'Owner access is no longer active';end if;
   update public.aerolog_equipment_shares set status=case when action='accept' then 'Accepted' else 'Declined' end,accepted_by=case when action='accept' then actor else null end,accepted_at=case when action='accept' then now() else null end where id=s.id returning * into s;
  else raise exception 'This share action is not available';end if;
 end if;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,actor,p.display_name,'equipment_share_'||action,'equipment_share',s.id::text,to_jsonb(s));
 return to_jsonb(s);
end;$$;
create function public.aerolog_equipment_share_list(actor uuid,expected_org uuid,page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;result jsonb;
begin
 select * into p from public.aerolog_profiles where id=actor and active;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Organization manager required' using errcode='42501';end if;
 if page<0 or page>10000 then raise exception 'Invalid page';end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
 select s.*,o.name owner_name,d.name recipient_name,
 case when s.expires_at<=now() then 'Expired' when s.status='Accepted' and (r.id is null or not exists(select 1 from public.aerolog_memberships where organization_id=s.owner_org and user_id=s.created_by and active and role in ('admin','manager'))) then 'Unavailable' else s.status end availability,
 case when (s.owner_org=expected_org or s.status='Accepted') and s.status not in ('Revoked','Declined') and s.expires_at>now() and exists(select 1 from public.aerolog_memberships where organization_id=s.owner_org and user_id=s.created_by and active and role in ('admin','manager')) then
 jsonb_build_object('name',coalesce(r.data->>'name',r.data->>'sourceName',r.data->>'model',r.id),'serial',r.data->>'serial','category',r.data->>'category','manufacturer',r.data->>'manufacturer','productModel',r.data->>'productModel','firmware',r.data->>'firmware','status',r.data->>'status','hours',r.data->'hours','cycles',r.data->'cycles','revision',r.revision,'updatedAt',r.updated_at) else null end equipment
 from public.aerolog_equipment_shares s join public.aerolog_organizations o on o.id=s.owner_org join public.aerolog_organizations d on d.id=s.recipient_org left join public.aerolog_records r on r.organization_id=s.owner_org and r.kind=s.kind and r.id=s.equipment_id
 where s.owner_org=expected_org or s.recipient_org=expected_org order by s.created_at desc,s.id limit 26 offset page*25
 )q;
 return result;
end;$$;
revoke all on function public.aerolog_equipment_share(uuid,uuid,text,jsonb),public.aerolog_equipment_share_list(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.aerolog_equipment_share(uuid,uuid,text,jsonb),public.aerolog_equipment_share_list(uuid,uuid,integer) to service_role;
