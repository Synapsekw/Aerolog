-- Financial reports capture authoritative work orders in the existing leased job.
do $$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('public.aerolog_report_enqueue(uuid,uuid,uuid,jsonb)'::regprocedure);
 needle:=$old$and ((input->>'includeHistory'='true'$old$;
 if position(needle in definition)=0 then raise exception 'Expected report history filter not found';end if;
 definition:=replace(definition,needle,$new$and ((input->>'type'='Maintenance costs' and kind='service') or (input->>'includeHistory'='true'$new$);
 needle:=$old$or kind='flight' or$old$;
 if position(needle in definition)=0 then raise exception 'Expected flight source filter not found';end if;
 definition:=replace(definition,needle,$new$or (kind='flight' and input->>'type'<>'Maintenance costs') or$new$);
 execute definition;
end;$$;
