create function public.aerolog_mission_kit_snapshot() returns trigger language plpgsql set search_path='' as $$
declare selection jsonb; kit public.aerolog_records; item jsonb; inventory public.aerolog_records; snapshots jsonb:='[]'; snapshot jsonb; contents jsonb; previous_selection jsonb; previous_snapshot jsonb;
begin
 if new.kind<>'mission' then return new; end if;
 if TG_OP='UPDATE' and old.data->>'status' not in ('Draft','Changes requested') then
  new.data:=new.data||jsonb_build_object('kitSelections',coalesce(old.data->'kitSelections','[]'),'kitSnapshots',coalesce(old.data->'kitSnapshots','[]'));
  return new;
 end if;
 if jsonb_typeof(coalesce(new.data->'kitSelections','[]'))<>'array' or jsonb_array_length(coalesce(new.data->'kitSelections','[]'))>20 then raise exception 'Invalid kit selection'; end if;
 for selection in select * from jsonb_array_elements(coalesce(new.data->'kitSelections','[]')) loop
  if exists(select 1 from jsonb_array_elements(snapshots) s where s->>'id'=selection->>'id') then raise exception 'Duplicate kit selection'; end if;
  previous_snapshot:=null;
  if TG_OP='UPDATE' then
   select s into previous_snapshot from jsonb_array_elements(coalesce(old.data->'kitSnapshots','[]')) s where s->>'id'=selection->>'id' and s->>'revision'=selection->>'revision';
  end if;
  if previous_snapshot is not null then
   snapshot:=previous_snapshot;
  else
   select * into kit from public.aerolog_records where organization_id=new.organization_id and kind='kit' and id=selection->>'id';
   if kit.id is null or kit.data->>'archived'='true' then raise exception 'Selected kit is unavailable'; end if;
   if kit.revision::text is distinct from selection->>'revision' then raise exception 'Kit changed. Preview and apply its current version.' using errcode='PT409'; end if;
   contents:='[]';
   for item in select * from jsonb_array_elements(kit.data->'items') loop
    select * into inventory from public.aerolog_records where organization_id=new.organization_id and kind=item->>'kind' and id=item->>'id';
    if inventory.id is null then raise exception 'Kit equipment no longer exists'; end if;
    contents:=contents||jsonb_build_array(jsonb_build_object('kind',inventory.kind,'id',inventory.id,'name',coalesce(inventory.data->>'name',inventory.data->>'sourceName',inventory.data->>'model',inventory.id),'serial',coalesce(inventory.data->>'serial',''),'status',inventory.data->>'status'));
   end loop;
   snapshot:=jsonb_build_object('id',kit.id,'revision',kit.revision,'name',kit.data->>'name','capturedAt',now(),'items',contents);
  end if;
  -- A snapshot must describe equipment actually selected, even in a draft.
  for item in select * from jsonb_array_elements(snapshot->'items') loop
   if item->>'kind'='battery' then
    if not (new.data->'equipment' ? (item->>'id')) then raise exception 'Kit battery removed. Unlink the kit or restore its equipment.'; end if;
   elsif item->>'name' is distinct from new.data->>'aircraft' and not (new.data->'equipment' ? (item->>'name')) then
    raise exception 'Kit equipment removed. Unlink the kit or restore its equipment.';
   end if;
  end loop;
  snapshots:=snapshots||jsonb_build_array(snapshot);
 end loop;
 new.data:=new.data||jsonb_build_object('kitSelections',coalesce(new.data->'kitSelections','[]'),'kitSnapshots',snapshots);
 return new;
end;$$;
create trigger mission_kit_snapshot before insert or update on public.aerolog_records for each row execute function public.aerolog_mission_kit_snapshot();
