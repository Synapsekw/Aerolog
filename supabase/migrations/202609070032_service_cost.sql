create function public.aerolog_service_cost_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.kind <> 'service' then return new; end if;
 if new.data->'cost' is not null and new.data->'cost'<>'null'::jsonb then
   if jsonb_typeof(new.data->'cost')<>'number' then raise exception 'Service cost must be numeric';end if;
   if (new.data->>'cost')::numeric<0 or (new.data->>'cost')::numeric>1000000000 then raise exception 'Service cost is outside the allowed range';end if;
   if coalesce(new.data->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'Service cost requires a three-letter currency code';end if;
 end if;
 if length(coalesce(new.data->>'costReference',''))>160 then raise exception 'Cost reference is too long';end if;
 return new;
end;$$;
create trigger aerolog_service_cost_guard before insert or update on public.aerolog_records
for each row execute function public.aerolog_service_cost_guard();
