create function public.aerolog_service_lifecycle_guard() returns trigger language plpgsql set search_path='' as $$
declare previous jsonb; actor public.aerolog_profiles; work public.aerolog_records;
begin
 if new.kind='mission' and new.data->>'status' in ('Pending approval','Approved') then
   perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
   for work in select * from public.aerolog_records where organization_id=new.organization_id and kind='service' and data->>'status'='In progress' loop
     if (work.data->>'targetKind'='asset' and work.data->>'asset'=any(public.aerolog_mission_aircraft(new.data))) or
        coalesce(new.data->'equipment','[]') ? (work.data->>'targetId') or
        coalesce(new.data->'equipment','[]') ? (work.data->>'asset') then
       raise exception 'Equipment has work in progress: %',work.data->>'task';
     end if;
   end loop;
   return new;
 end if;
 if new.kind<>'service' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,0));
 select data into previous from public.aerolog_records where organization_id=new.organization_id and kind='service' and id=new.id;
 if new.data->>'status' not in ('Scheduled','Upcoming','Overdue','In progress','Completed') then raise exception 'Invalid maintenance status';end if;
 if previous->>'status'='In progress' and new.data->>'status' not in ('In progress','Completed') then raise exception 'Started work must be signed off';end if;
 if previous->>'startedAt' is not null then
   if new.data->>'targetKind' is distinct from previous->>'targetKind' or new.data->>'targetId' is distinct from previous->>'targetId' then raise exception 'Started work cannot be reassigned to different equipment';end if;
   new.data:=new.data||jsonb_build_object('startedAt',previous->'startedAt','startedBy',previous->'startedBy','startedById',previous->'startedById');
 elsif new.data->>'status'='In progress' then
   select * into actor from public.aerolog_profiles where id=auth.uid() and active and organization_id=new.organization_id;
   if actor.id is null or actor.role not in ('admin','manager','technician') then raise exception 'Fleet permission required to start work';end if;
   new.data:=new.data||jsonb_build_object('startedAt',now(),'startedBy',actor.display_name,'startedById',actor.id);
 else
   new.data:=new.data-'startedAt'-'startedBy'-'startedById';
 end if;
 return new;
end;$$;
create trigger aerolog_service_lifecycle_guard before insert or update on public.aerolog_records for each row execute function public.aerolog_service_lifecycle_guard();
