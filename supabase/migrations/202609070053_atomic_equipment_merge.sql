create table public.aerolog_equipment_merges(
 id uuid primary key,organization_id uuid not null references public.aerolog_organizations(id),kind text not null check(kind in ('asset','battery')),
 keep_id text not null,duplicate_id text not null,actor_id uuid not null,created_at timestamptz not null default now(),request jsonb not null,receipt jsonb not null,
 foreign key(organization_id,kind,keep_id) references public.aerolog_records(organization_id,kind,id),
 foreign key(organization_id,kind,duplicate_id) references public.aerolog_records(organization_id,kind,id)
);
alter table public.aerolog_equipment_merges enable row level security;
revoke all on public.aerolog_equipment_merges from anon,authenticated;
create function public.aerolog_equipment_merge_preflight(actor uuid,expected_org uuid,equipment_kind text,keep_id text,duplicate_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;aliases jsonb;routes jsonb;state jsonb;family text[];reports jsonb;shares jsonb;
begin
 context:=public.aerolog_equipment_merge_context(actor,expected_org,equipment_kind,keep_id,duplicate_id);
 select coalesce(jsonb_agg(to_jsonb(a) order by kind,source_id),'[]') into aliases from public.aerolog_equipment_aliases a where organization_id=expected_org;
 select coalesce(jsonb_agg(to_jsonb(r) order by plan_id),'[]') into routes from public.aerolog_inspection_meter_routes r where organization_id=expected_org;
 select jsonb_agg(to_jsonb(r) order by id) into state from public.aerolog_records r where organization_id=expected_org and kind=equipment_kind and id in (keep_id,duplicate_id);
 with recursive identities(id) as (select unnest(array[keep_id,duplicate_id]) union select a.source_id from public.aerolog_equipment_aliases a join identities i on a.canonical_id=i.id where a.organization_id=expected_org and a.kind=equipment_kind) select array_agg(id) into family from identities;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'request',request,'createdAt',created_at) order by id),'[]') into reports from public.aerolog_report_jobs j where organization_id=expected_org and exists(select 1 from unnest(family) target where jsonb_path_exists(j.snapshot,'$.** ? (@ == $target)',jsonb_build_object('target',target)));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'equipmentId',equipment_id,'recipientOrg',recipient_org,'expiresAt',expires_at) order by id),'[]') into shares from public.aerolog_equipment_shares where owner_org=expected_org and kind=equipment_kind and equipment_id=any(family);
 context:=context||jsonb_build_object('reportReferences',reports,'shareReferences',shares);
 context:=context||jsonb_build_object('aliases',aliases,'inspectionMeterRoutes',routes,'equipmentState',state);
 return context||jsonb_build_object('contextFingerprint',md5((context-array['capturedAt','reviewDate'])::text));
end;$$;
create function public.aerolog_equipment_merge_apply(actor uuid,expected_org uuid,operation_id uuid,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p public.aerolog_profiles;kept public.aerolog_records;duplicate public.aerolog_records;prior public.aerolog_equipment_merges;
 context jsonb;kind text:=input->>'kind';keep_id text:=input->>'keepId';duplicate_id text:=input->>'duplicateId';counter_source text:=input->>'counterSource';reason text:=btrim(input->>'reason');
 field text;value numeric;next_value numeric;interval_value numeric;health_value numeric;temp_value numeric;next_status text;doc jsonb;family text[];captured jsonb:='[]';plan public.aerolog_records;meters jsonb;route jsonb;counted integer;receipt jsonb;routes_before jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager') then raise exception 'Organization manager required' using errcode='42501';end if;
 select * into prior from public.aerolog_equipment_merges where id=operation_id;
 if prior.id is not null then
  if prior.organization_id=expected_org and prior.actor_id=actor and prior.request=input then return prior.receipt;end if;
  raise exception 'This operation ID cannot be reused for a different merge';
 end if;
 if input->>'physicalIdentityConfirmed' is distinct from 'true' or reason is null or length(reason) not between 10 and 1000 or counter_source not in ('keep','duplicate') or counter_source is null then raise exception 'Confirm the physical identity and record counter evidence';end if;
 context:=public.aerolog_equipment_merge_preflight(actor,expected_org,kind,keep_id,duplicate_id);
 if input->>'contextFingerprint' is distinct from context->>'contextFingerprint' then raise exception 'Merge context changed. Compare the records again.' using errcode='PT409';end if;
 if exists(select 1 from public.aerolog_equipment_aliases where organization_id=expected_org and aerolog_equipment_aliases.kind=kind and source_id in (keep_id,duplicate_id)) then raise exception 'Select canonical records for this merge';end if;
 select * into kept from public.aerolog_records where organization_id=expected_org and aerolog_records.kind=kind and id=keep_id for update;
 select * into duplicate from public.aerolog_records where organization_id=expected_org and aerolog_records.kind=kind and id=duplicate_id for update;
 if kind='asset' and 'Checked out' in (kept.data->>'status',duplicate.data->>'status') then raise exception 'Return checked-out equipment before merging';end if;
 if kind='asset' and kept.data->>'category' is distinct from duplicate.data->>'category' then raise exception 'Equipment categories must match';end if;
 if btrim(coalesce(kept.data->>'serial',''))<>'' and btrim(coalesce(duplicate.data->>'serial',''))<>'' and btrim(kept.data->>'serial')<>btrim(duplicate.data->>'serial') then raise exception 'Recorded serial numbers conflict. Correct identity evidence before merging.';end if;
 with recursive identities(id) as (select unnest(array[keep_id,duplicate_id]) union select a.source_id from public.aerolog_equipment_aliases a join identities i on a.canonical_id=i.id where a.organization_id=expected_org and a.kind=kind) select array_agg(id) into family from identities;
 if exists(select 1 from public.aerolog_records m where m.organization_id=expected_org and m.kind='mission' and m.data->>'status' in ('Pending approval','Approved') and exists(select 1 from public.aerolog_records e where e.organization_id=expected_org and e.kind=kind and e.id=any(family) and ((kind='battery' and coalesce(m.data->'equipment','[]') ? e.id) or (kind='asset' and (e.data->>'name'=any(public.aerolog_mission_aircraft(m.data)) or coalesce(m.data->'equipment','[]') ? (e.data->>'name'))) or exists(select 1 from jsonb_array_elements(coalesce(m.data->'kitSnapshots','[]')) snap cross join lateral jsonb_array_elements(coalesce(snap->'items','[]')) item where item->>'kind'=kind and item->>'id'=e.id)))) then raise exception 'Complete or withdraw active mission packages before merging their equipment';end if;
 if exists(select 1 from public.aerolog_records work where work.organization_id=expected_org and work.kind='service' and work.data->>'status'<>'Completed' and ((work.data->>'targetKind'=kind and work.data->>'targetId'=any(family)) or (kind='asset' and nullif(work.data->>'targetId','') is null and exists(select 1 from public.aerolog_records e where e.organization_id=expected_org and e.kind='asset' and e.id=any(family) and e.data->>'name'=work.data->>'asset')))) then raise exception 'Finish or reassign open work orders before merging equipment';end if;
 if exists(select 1 from public.aerolog_equipment_shares s where s.owner_org=expected_org and s.kind=kind and s.equipment_id=any(family) and s.status in ('Pending','Accepted') and s.expires_at>now()) then raise exception 'End active equipment sharing before merging';end if;
 field:=case when kind='battery' then 'cycles' else 'hours' end;
 value:=(case when counter_source='keep' then kept.data else duplicate.data end->>field)::numeric;
 if (kind='battery' and (value is null or trunc(value)<>value)) or (value is not null and (value<0 or value>100000)) then raise exception 'Selected counter is invalid or missing';end if;
 if value is null and exists(select 1 from public.aerolog_records ip where ip.organization_id=expected_org and ip.kind='inspection_plan' and ip.data->>'targetKind'=kind and ip.data->>'targetId'=any(family) and exists(select 1 from jsonb_array_elements(ip.data->'profileSnapshot'->'rules') rule where rule->>field is not null)) then raise exception 'Verify the usage register before merging equipment with counter-based inspections';end if;
 doc:=kept.data||jsonb_build_object(field,value);
 if kind='asset' then
  next_value:=case when value is null or kept.data->>'hours' is null or duplicate.data->>'hours' is null or kept.data->>'next' is null or duplicate.data->>'next' is null then null else least(100000,greatest(1,value+least((kept.data->>'next')::numeric-(kept.data->>'hours')::numeric,(duplicate.data->>'next')::numeric-(duplicate.data->>'hours')::numeric))) end;
  interval_value:=case when kept.data->>'intervalHours' is null or duplicate.data->>'intervalHours' is null then null else least((kept.data->>'intervalHours')::numeric,(duplicate.data->>'intervalHours')::numeric) end;
  next_status:=case when 'Retired' in (kept.data->>'status',duplicate.data->>'status') then 'Retired' when 'Unverified' in (kept.data->>'status',duplicate.data->>'status') or value is null or next_value is null or interval_value is null then 'Unverified' when 'Maintenance due' in (kept.data->>'status',duplicate.data->>'status') or next_value<=value or (kept.data->>'hours')::numeric>=(kept.data->>'next')::numeric or (duplicate.data->>'hours')::numeric>=(duplicate.data->>'next')::numeric then 'Maintenance due' when 'Checked out' in (kept.data->>'status',duplicate.data->>'status') then 'Checked out' else 'Available' end;
  doc:=doc||jsonb_build_object('next',next_value,'intervalHours',interval_value,'status',next_status);
 else
  health_value:=case when kept.data->>'health' is null or duplicate.data->>'health' is null then null else least((kept.data->>'health')::numeric,(duplicate.data->>'health')::numeric) end;
  temp_value:=case when kept.data->>'temp' is null or duplicate.data->>'temp' is null then null else greatest((kept.data->>'temp')::numeric,(duplicate.data->>'temp')::numeric) end;
  next_status:=case when 'Retired' in (kept.data->>'status',duplicate.data->>'status') then 'Retired' when 'Quarantined' in (kept.data->>'status',duplicate.data->>'status') then 'Quarantined' when 'Unverified' in (kept.data->>'status',duplicate.data->>'status') or health_value is null or temp_value is null then 'Unverified' when 'Attention required' in (kept.data->>'status',duplicate.data->>'status') then 'Attention required' else 'Healthy' end;
  doc:=doc||jsonb_build_object('health',health_value,'temp',temp_value,'status',next_status);
 end if;
 routes_before:=context->'inspectionMeterRoutes';
 for plan in select * from public.aerolog_records r where r.organization_id=expected_org and r.kind='inspection_plan' and ((r.data->>'targetKind'=kind and r.data->>'targetId'=any(family)) or exists(select 1 from public.aerolog_inspection_meter_routes mr where mr.organization_id=expected_org and mr.plan_id=r.id and mr.target_kind=kind and mr.target_id=any(family))) loop
  meters:=public.aerolog_inspection_current_meters(expected_org,plan.id);
  captured:=captured||jsonb_build_array(jsonb_build_object('planId',plan.id,'meters',meters));
 end loop;
 update public.aerolog_records set data=doc,revision=revision+1,updated_at=now() where organization_id=expected_org and aerolog_records.kind=kind and id=keep_id;
 insert into public.aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by)values(expected_org,kind,duplicate_id,keep_id,actor);
 counted:=public.aerolog_equipment_family_flight_count(expected_org,kind,keep_id);
 for route in select * from jsonb_array_elements(captured) loop
  insert into public.aerolog_inspection_meter_routes(organization_id,plan_id,target_kind,target_id,hours_anchor,cycles_anchor,flights_anchor,hours_base,cycles_base,flights_base)
  values(expected_org,route->>'planId',kind,keep_id,(doc->>'hours')::numeric,(doc->>'cycles')::numeric,counted,(route->'meters'->>'hours')::numeric,(route->'meters'->>'cycles')::numeric,(route->'meters'->>'flights')::numeric)
  on conflict(organization_id,plan_id) do update set target_kind=excluded.target_kind,target_id=excluded.target_id,hours_anchor=excluded.hours_anchor,cycles_anchor=excluded.cycles_anchor,flights_anchor=excluded.flights_anchor,hours_base=excluded.hours_base,cycles_base=excluded.cycles_base,flights_base=excluded.flights_base,updated_at=now();
 end loop;
 receipt:=jsonb_build_object('id',operation_id,'kind',kind,'keepId',keep_id,'duplicateId',duplicate_id,'revision',kept.revision+1,'equipment',doc,'inspectionPlans',jsonb_array_length(captured),'createdAt',now());
 insert into public.aerolog_equipment_merges(id,organization_id,kind,keep_id,duplicate_id,actor_id,request,receipt)values(operation_id,expected_org,kind,keep_id,duplicate_id,actor,input,receipt);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,actor,p.display_name,'equipment_merged',kind,keep_id,jsonb_build_object('keep',to_jsonb(kept),'duplicate',to_jsonb(duplicate),'inspectionRoutes',routes_before),jsonb_build_object('receipt',receipt,'counterSource',counter_source,'reason',reason,'inspectionBases',captured));
 return receipt;
end;$$;
revoke all on function public.aerolog_equipment_merge_preflight(uuid,uuid,text,text,text),public.aerolog_equipment_merge_apply(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_equipment_merge_preflight(uuid,uuid,text,text,text),public.aerolog_equipment_merge_apply(uuid,uuid,uuid,jsonb) to service_role;
-- New directory offers must not revive frozen source identities after a merge.
create function public.aerolog_share_canonical_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.aerolog_equipment_aliases where organization_id=new.owner_org and kind=new.kind and source_id=new.equipment_id) then
  raise exception 'Offer the canonical equipment record instead of a merged source' using errcode='PT409';
 end if;
 return new;
end;$$;
create trigger aerolog_share_canonical_guard before insert on public.aerolog_equipment_shares for each row execute function public.aerolog_share_canonical_guard();
revoke all on function public.aerolog_share_canonical_guard() from public,anon,authenticated;
