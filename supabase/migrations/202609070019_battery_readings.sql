alter table public.aerolog_records drop constraint aerolog_records_kind_check;
alter table public.aerolog_records add constraint aerolog_records_kind_check check(kind in ('mission','asset','battery','crew','flight','service','battery_event','attachment','kit','inspection_profile','inspection_plan','inspection_event','battery_reading'));
create function public.aerolog_battery_reading(actor uuid,expected_org uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;b public.aerolog_records;doc jsonb:=document;prior timestamptz;next_data jsonb;rules jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager','technician') then raise exception 'Active fleet role required in this organization' using errcode='42501';end if;
 select * into b from public.aerolog_records where organization_id=expected_org and kind='battery' and id=doc->>'batteryId' for update;
 if b.id is null then raise exception 'Battery not found';end if;
 if exists(select 1 from public.aerolog_records where organization_id=expected_org and kind='battery_reading' and id=doc->>'id') then raise exception 'Reading already saved. Refresh the battery history.' using errcode='PT409';end if;
 if (doc->>'measuredAt')::timestamptz>now() then raise exception 'Measurement cannot be in the future';end if;
 if (doc->>'applyToRegister')::boolean then
  select max((data->>'measuredAt')::timestamptz) into prior from public.aerolog_records where organization_id=expected_org and kind='battery_reading' and data->>'batteryId'=b.id and data->>'applyToRegister'='true';
  select greatest(prior,max((data->>'date')::timestamptz)) into prior from public.aerolog_records where organization_id=expected_org and kind='battery_event' and data->>'battery'=b.id and (data->>'cycles' is not null or data->>'health' is not null);
  if prior is not null and (doc->>'measuredAt')::timestamptz<prior then raise exception 'An older reading cannot replace a newer register reading';end if;
  if doc->>'deviceCycles' is not null and (doc->>'deviceCycles')::numeric<(b.data->>'cycles')::numeric then raise exception 'Cycle count is below the register. Save as history only and review the discrepancy.';end if;
  select settings into rules from public.aerolog_organizations where id=expected_org;
  -- Values are absolute measurements, never increments. Missing channels preserve their previous value.
  next_data:=b.data||jsonb_build_object('cycles',coalesce((doc->>'deviceCycles')::numeric,(b.data->>'cycles')::numeric),'health',coalesce((doc->>'health')::numeric,(b.data->>'health')::numeric),'temp',coalesce((doc->>'temperature')::numeric,(b.data->>'temp')::numeric));
  if b.data->>'status' not in ('Retired','Quarantined','Unverified') and ((next_data->>'health')::numeric<coalesce((rules->>'batteryMinHealth')::numeric,80) or (next_data->>'temp')::numeric>coalesce((rules->>'batteryMaxTemperature')::numeric,50)) then next_data:=next_data||jsonb_build_object('status','Attention required');end if;
  update public.aerolog_records set data=next_data,revision=revision+1,updated_at=now() where organization_id=expected_org and kind='battery' and id=b.id;
 end if;
 doc:=doc||jsonb_build_object('recordedBy',p.display_name,'recordedById',p.id,'recordedAt',now());
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'battery_reading',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)values(expected_org,p.id,p.display_name,'battery_reading_saved','battery',b.id,b.data,jsonb_build_object('reading',doc,'register',coalesce(next_data,b.data)));
 return doc;
end;$$;
revoke all on function public.aerolog_battery_reading(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_battery_reading(uuid,uuid,jsonb) to service_role;
create function public.aerolog_equipment_attach(actor uuid,expected_org uuid,document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles;doc jsonb:=document;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.organization_id<>expected_org or p.role not in ('admin','manager','technician') then raise exception 'Active fleet role required' using errcode='42501';end if;
 if doc->>'targetKind' not in ('asset','battery') or not exists(select 1 from public.aerolog_records where organization_id=expected_org and kind=doc->>'targetKind' and id=doc->>'targetId') then raise exception 'Equipment not found';end if;
 if doc->>'path' is distinct from expected_org::text||'/equipment/'||(doc->>'id') then raise exception 'Invalid equipment attachment path';end if;
 doc:=doc||jsonb_build_object('uploadedBy',p.display_name,'uploadedAt',now());
 insert into public.aerolog_records(organization_id,kind,id,data,created_by)values(expected_org,'attachment',doc->>'id',doc,p.id);
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,after_data)values(expected_org,p.id,p.display_name,'equipment_attachment_added',doc->>'targetKind',doc->>'targetId',doc);
 return doc;
end;$$;
revoke all on function public.aerolog_equipment_attach(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.aerolog_equipment_attach(uuid,uuid,jsonb) to service_role;
