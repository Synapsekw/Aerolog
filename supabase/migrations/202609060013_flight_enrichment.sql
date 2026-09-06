-- Only the server can call this narrow, transactional enrichment operation.
create or replace function public.aerolog_enrich_flight(actor uuid,expected_org uuid,target_id text,expected_revision integer,patch jsonb,source_hash text,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.aerolog_profiles; old public.aerolog_records; doc jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(expected_org::text,0));
 select * into p from public.aerolog_profiles where id=actor and active for update;
 if p.id is null or p.role not in ('admin','manager') then raise exception 'Manager access required' using errcode='42501';end if;
 if p.organization_id<>expected_org then raise exception 'Organization changed. Refresh.' using errcode='PT409';end if;
 select * into old from public.aerolog_records where organization_id=expected_org and kind='flight' and id=target_id for update;
 if old.id is null then raise exception 'Flight not found';end if;
 if old.revision<>expected_revision then raise exception 'Flight changed. Refresh and review again.' using errcode='PT409';end if;
 if length(reason)<20 or source_hash !~ '^[a-f0-9]{64}$' then raise exception 'Source hash and review reason required';end if;
 if patch - array['telemetry','startedAt','aircraftSerial','batterySerials'] <> '{}'::jsonb or jsonb_typeof(patch->'telemetry') is distinct from 'array' then raise exception 'Invalid enrichment fields';end if;
 if coalesce(old.data->'enrichmentHashes','[]'::jsonb) ? source_hash then raise exception 'Source already used for enrichment';end if;
 doc=old.data || patch || jsonb_build_object('enrichmentHashes',coalesce(old.data->'enrichmentHashes','[]'::jsonb)||to_jsonb(source_hash));
 update public.aerolog_records set data=doc,revision=revision+1,updated_at=now() where organization_id=expected_org and kind='flight' and id=target_id;
 insert into public.aerolog_audit(organization_id,actor_id,actor_name,action,kind,record_id,before_data,after_data)
 values(expected_org,actor,p.display_name,'flight_telemetry_enriched','flight',target_id,old.data,jsonb_build_object('flight',doc,'reason',reason,'sourceHash',source_hash));
 return jsonb_build_object('id',target_id,'revision',old.revision+1);
end;$$;
revoke all on function public.aerolog_enrich_flight(uuid,uuid,text,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.aerolog_enrich_flight(uuid,uuid,text,integer,jsonb,text,text) to service_role;
