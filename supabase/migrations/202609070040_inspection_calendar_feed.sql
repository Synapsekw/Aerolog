do $$
declare constraint_name text;definition text;needle text;
begin
 select conname into constraint_name from pg_constraint where conrelid='public.aerolog_calendar_shares'::regclass and contype='c' and pg_get_constraintdef(oid) like '%kinds%';
 execute format('alter table public.aerolog_calendar_shares drop constraint %I',constraint_name);
 alter table public.aerolog_calendar_shares add constraint calendar_share_kinds check(cardinality(kinds)>0 and kinds <@ array['mission','service','flight','inspection']);
 definition:=pg_get_functiondef('public.aerolog_calendar_feed(text)'::regprocedure);
 needle:=$old$ return jsonb_build_object('organizationId'$old$;
 if position(needle in definition)=0 then raise exception 'Calendar feed projection not found';end if;
 definition:=replace(definition,needle,$new$
 if 'inspection'=any(share.kinds) then
  entries:=entries||coalesce((select jsonb_agg(jsonb_build_object(
   'id',plan.id||':'||(rule->>'id'),'kind','inspection',
   'name',coalesce(equipment.data->>'name',equipment.data->>'sourceName',equipment.data->>'model',plan.data->>'targetId')||' · '||(rule->>'name'),
   'date',due.due_date,'time','','status','Calendar interval; counters may make this due earlier'
  ) order by plan.id,rule->>'id')
  from public.aerolog_records plan
  cross join lateral jsonb_array_elements(plan.data->'profileSnapshot'->'rules') rule
  left join public.aerolog_records equipment on equipment.organization_id=share.organization_id and equipment.kind=plan.data->>'targetKind' and equipment.id=plan.data->>'targetId'
  left join lateral (select event.data->>'date' date from public.aerolog_records event where event.organization_id=share.organization_id and event.kind='inspection_event' and event.data->>'planId'=plan.id and event.data->>'ruleId'=rule->>'id' order by event.data->>'date' desc,event.data->>'signedAt' desc nulls last limit 1) latest on true
  cross join lateral (select coalesce(latest.date,plan.data->>'baselineDate')::date+(rule->>'days')::integer due_date) due
  where plan.organization_id=share.organization_id and plan.kind='inspection_plan' and rule->>'days' is not null and due.due_date between share.date_from and share.date_to),'[]'::jsonb);
 end if;
 return jsonb_build_object('organizationId'$new$);
 execute definition;
end;$$;
