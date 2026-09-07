-- Optional history is captured in the same frozen snapshot as flight summaries.
do $$
declare definition text; needle text; replacement text;
begin
 definition:=pg_get_functiondef('public.aerolog_report_enqueue(uuid,uuid,uuid,jsonb)'::regprocedure);
 needle:=$old$else jsonb_build_object('name',data->'name','model',data->'model','sourceName',data->'sourceName','category',data->'category') end$old$;
 if position(needle in definition)=0 then raise exception 'Expected report snapshot projection not found';end if;
 definition:=replace(definition,needle,'else r.data end');
 needle:=$old$and (kind='flight' or$old$;
 replacement:=$new$and ((input->>'includeHistory'='true' and kind in ('service','inspection_plan','inspection_event','battery_reading','battery_event')) or kind='flight' or$new$;
 if position(needle in definition)=0 then raise exception 'Expected report source filter not found';end if;
 execute replace(definition,needle,replacement);
end;$$;
