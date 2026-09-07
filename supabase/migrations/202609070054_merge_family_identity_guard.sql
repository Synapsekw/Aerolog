-- Validate the complete retained identity family, including earlier merged sources.
do $$
declare definition text;anchor text;guard text;
begin
 definition:=pg_get_functiondef('public.aerolog_equipment_merge_apply(uuid,uuid,uuid,jsonb)'::regprocedure);
 anchor:=$anchor$ if exists(select 1 from public.aerolog_records m$anchor$;
 guard:=$guard$ if (select count(distinct btrim(r.data->>'serial')) from public.aerolog_records r where r.organization_id=expected_org and r.kind=kind and r.id=any(family) and btrim(coalesce(r.data->>'serial',''))<>'')>1 then raise exception 'Recorded serial numbers conflict within the retained identity family';end if;
 if kind='asset' and ((kept.data->>'category') is null or (select count(distinct r.data->>'category') from public.aerolog_records r where r.organization_id=expected_org and r.kind=kind and r.id=any(family))<>1) then raise exception 'Equipment categories must match across the retained identity family';end if;
$guard$;
 if position('Recorded serial numbers conflict within the retained identity family' in definition)>0 then return;end if;
 if position(anchor in definition)=0 then raise exception 'Expected merge implementation not found';end if;
 execute replace(definition,anchor,guard||anchor);
end;$$;
