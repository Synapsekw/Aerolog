do $$
declare definition text; old_path text; new_path text;
begin
 definition:=pg_get_functiondef('public.aerolog_report_finish(uuid,uuid,jsonb,jsonb,text,text)'::regprocedure);
 old_path:=$old$token::text||'.csv'$old$;
 new_path:=$new$token::text||(case when job.request->>'format'='PDF' then '.pdf' else '.csv' end)$new$;
 if position(old_path in definition)=0 then raise exception 'Expected artifact path validation not found';end if;
 execute replace(definition,old_path,new_path);
end;$$;
