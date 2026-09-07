create table public.aerolog_calendar_shares(
 id uuid primary key, organization_id uuid not null references public.aerolog_organizations(id),
 created_by uuid not null, label text not null, token_hash text not null unique,
 date_from date not null, date_to date not null, kinds text[] not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
 check(date_to>=date_from), check(cardinality(kinds)>0 and kinds <@ array['mission','service','flight']),
 check(token_hash ~ '^[a-f0-9]{64}$')
);
alter table public.aerolog_calendar_shares enable row level security;
revoke all on public.aerolog_calendar_shares from anon,authenticated;

create function public.aerolog_calendar_share(actor uuid, expected_org uuid, action text, document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; share public.aerolog_calendar_shares;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Organization manager required' using errcode='42501';end if;
 if action='create' then
  if (document->>'expiresAt')::timestamptz<=now() or (document->>'expiresAt')::timestamptz>now()+interval '366 days' then raise exception 'Expiry must be within one year';end if;
  insert into public.aerolog_calendar_shares(id,organization_id,created_by,label,token_hash,date_from,date_to,kinds,expires_at)
  values((document->>'id')::uuid,expected_org,actor,document->>'label',document->>'hash',(document->>'from')::date,(document->>'to')::date,array(select jsonb_array_elements_text(document->'kinds')),(document->>'expiresAt')::timestamptz) returning * into share;
 elsif action='revoke' then
  update public.aerolog_calendar_shares set revoked_at=coalesce(revoked_at,now()) where id=(document->>'id')::uuid and organization_id=expected_org returning * into share;
  if share.id is null then raise exception 'Calendar share not found';end if;
 else raise exception 'Unsupported calendar share action';end if;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,actor,p.display_name,'calendar_share_'||action,'calendar_share',share.id::text,to_jsonb(share)-'token_hash');
 return to_jsonb(share)-'token_hash';
end;$$;

create function public.aerolog_calendar_feed(hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare share public.aerolog_calendar_shares; entries jsonb; zone text;
begin
 select * into share from public.aerolog_calendar_shares where token_hash=hash and revoked_at is null and expires_at>now();
 if share.id is null then return null;end if;
 if not exists(select 1 from public.aerolog_memberships where organization_id=share.organization_id and user_id=share.created_by and active and role in ('admin','manager')) then return null;end if;
 select coalesce(settings->>'timezone','UTC') into zone from public.aerolog_organizations where id=share.organization_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'name',coalesce(r.data->>'name',r.data->>'task',r.data->>'mission',r.id),'date',case when r.kind='service' then r.data->>'due' else r.data->>'date' end,'time',case when r.kind='mission' then coalesce(r.data->>'time','') else '' end,'durationMinutes',case when r.kind='mission' then r.data->'durationMinutes' else null end,'status',coalesce(r.data->>'status','Recorded')) order by r.kind,r.id),'[]') into entries
 from public.aerolog_records r where organization_id=share.organization_id and kind=any(share.kinds)
 and (case when kind='service' then data->>'due' else data->>'date' end) between share.date_from::text and share.date_to::text;
 return jsonb_build_object('organizationId',share.organization_id,'from',share.date_from,'through',share.date_to,'timezone',zone,'entries',entries);
end;$$;
revoke all on function public.aerolog_calendar_share(uuid,uuid,text,jsonb),public.aerolog_calendar_feed(text) from public,anon,authenticated;
grant execute on function public.aerolog_calendar_share(uuid,uuid,text,jsonb),public.aerolog_calendar_feed(text) to service_role;
