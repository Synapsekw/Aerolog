-- Extend the current enqueue routine without replacing prior financial/PDF behavior.
do $$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.aerolog_report_enqueue(uuid,uuid,uuid,jsonb)'::regprocedure);
 needle:=$old$'aircraftId',data->'aircraftId','durationSeconds'$old$;
 if position(needle in definition)=0 then raise exception 'Expected flight projection not found';end if;
 definition:=replace(definition,needle,$new$'aircraftId',data->'aircraftId','equipmentIds',data->'equipmentIds','durationSeconds'$new$);
 needle:=$old$kind='asset' and id=input->>'entityId'$old$;
 if position(needle in definition)=0 then raise exception 'Expected aircraft scope not found';end if;
 definition:=replace(definition,needle,$new$kind='asset'$new$);
 needle:=$old$kind='battery' and id=input->>'entityId'$old$;
 if position(needle in definition)=0 then raise exception 'Expected battery scope not found';end if;
 definition:=replace(definition,needle,$new$kind='battery'$new$);
 needle:=$old$'records',records,'members',members$old$;
 if position(needle in definition)=0 then raise exception 'Expected snapshot body not found';end if;
 definition:=replace(definition,needle,$new$'records',records,'members',members,'equipmentAliases',(select coalesce(jsonb_agg(jsonb_build_object('kind',a.kind,'source_id',a.source_id,'canonical_id',a.canonical_id) order by a.kind,a.source_id),'[]') from public.aerolog_equipment_aliases a where a.organization_id=expected_org and ((input->>'type'='Aircraft' and a.kind='asset') or (input->>'type'='Battery' and a.kind='battery')))$new$);
 execute definition;
end;$$;
