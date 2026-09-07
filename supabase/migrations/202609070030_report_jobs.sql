create table public.aerolog_report_jobs(
 id uuid primary key,organization_id uuid not null references public.aerolog_organizations(id),requested_by uuid not null references public.aerolog_profiles(id),requested_name text not null,
 request jsonb not null,snapshot jsonb not null,status text not null default 'Queued' check(status in ('Queued','Running','Completed','Failed')),
 created_at timestamptz not null default now(),started_at timestamptz,completed_at timestamptz,lease_until timestamptz,lease_token uuid,attempts integer not null default 0,
 attachment_id text,error text,sha256 text,summary jsonb
);
alter table public.aerolog_report_jobs enable row level security;
create policy report_job_read on public.aerolog_report_jobs for select to authenticated using(organization_id=public.aerolog_org());
revoke all on public.aerolog_report_jobs from anon,authenticated;
grant select on public.aerolog_report_jobs to authenticated;
create index report_job_org_created on public.aerolog_report_jobs(organization_id,created_at desc);
create function public.aerolog_report_enqueue(actor uuid,expected_org uuid,job_id uuid,input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;previous public.aerolog_report_jobs;records jsonb;members jsonb;org_name text;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org then raise exception 'Active organization member required' using errcode='42501';end if;
 select * into previous from public.aerolog_report_jobs where id=job_id;
 if previous.id is not null then if previous.organization_id<>expected_org or previous.requested_by<>actor or previous.request<>input then raise exception 'Report request ID already used';end if;return job_id;end if;
 select name into org_name from public.aerolog_organizations where id=expected_org;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'revision',r.revision,'data',case when kind='flight' then jsonb_build_object('id',r.id,'date',data->'date','startedAt',data->'startedAt','mission',data->'mission','pilot',data->'pilot','pilotUserId',data->'pilotUserId','aircraft',data->'aircraft','aircraftId',data->'aircraftId','durationSeconds',data->'durationSeconds','distance',data->'distance','batteryIds',data->'batteryIds','battery',data->'battery','source',data->'source','importHash',data->'importHash') else jsonb_build_object('name',data->'name','model',data->'model','sourceName',data->'sourceName','category',data->'category') end) order by r.kind,r.id),'[]') into records from public.aerolog_records r where organization_id=expected_org and (kind='flight' or (input->>'type'='Aircraft' and kind='asset' and id=input->>'entityId') or (input->>'type'='Battery' and kind='battery' and id=input->>'entityId'));
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'display_name',display_name) order by user_id),'[]') into members from public.aerolog_memberships where organization_id=expected_org;
 insert into public.aerolog_report_jobs(id,organization_id,requested_by,requested_name,request,snapshot)values(job_id,expected_org,actor,p.display_name,input,jsonb_build_object('version',1,'organization',org_name,'records',records,'members',members));
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,actor,p.display_name,'report_requested','report_job',job_id::text,input);return job_id;
end;$$;
create function public.aerolog_report_claim(actor uuid,expected_org uuid,job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;job public.aerolog_report_jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org then raise exception 'Active organization member required' using errcode='42501';end if;
 select * into job from public.aerolog_report_jobs where id=job_id and organization_id=expected_org for update;
 if job.id is null then raise exception 'Report not found';end if;
 if job.status='Completed' or (job.status='Running' and job.lease_until>now()) then return null;end if;
 update public.aerolog_report_jobs set status='Running',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',started_at=now(),attempts=attempts+1,error=null where id=job_id returning * into job;
 return to_jsonb(job);
end;$$;
create function public.aerolog_report_finish(job_id uuid,token uuid,artifact jsonb,result_summary jsonb,content_hash text,failure text) returns boolean language plpgsql security definer set search_path='' as $$
declare job public.aerolog_report_jobs;
begin
 select * into job from public.aerolog_report_jobs where id=job_id for update;
 if job.id is null or job.status<>'Running' or job.lease_token is distinct from token then return false;end if;
 if failure is not null then update public.aerolog_report_jobs set status='Failed',error=left(failure,1000),lease_until=null where id=job_id;return true;end if;
 if artifact->>'id'<>job_id::text or artifact->>'path' is distinct from job.organization_id::text||'/reports/'||job_id::text||'/'||token::text||'.csv' then raise exception 'Invalid report artifact';end if;
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(job.organization_id,'attachment',job_id::text,artifact||jsonb_build_object('targetKind','report_job','targetId',job_id,'uploadedBy',job.requested_name,'uploadedAt',now()),job.requested_by);
 update public.aerolog_report_jobs set status='Completed',completed_at=now(),lease_until=null,attachment_id=job_id::text,sha256=content_hash,summary=result_summary where id=job_id;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(job.organization_id,job.requested_by,job.requested_name,'report_completed','report_job',job_id::text,result_summary);return true;
end;$$;
revoke all on function public.aerolog_report_enqueue(uuid,uuid,uuid,jsonb),public.aerolog_report_claim(uuid,uuid,uuid),public.aerolog_report_finish(uuid,uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.aerolog_report_enqueue(uuid,uuid,uuid,jsonb),public.aerolog_report_claim(uuid,uuid,uuid),public.aerolog_report_finish(uuid,uuid,jsonb,jsonb,text,text) to service_role;
