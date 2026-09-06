-- Imported inventory uses source GUID identity: source serials can be missing or duplicated.
drop index public.aerolog_asset_serial;
create unique index aerolog_asset_serial on public.aerolog_records(organization_id, lower(data->>'serial'))
where kind='asset' and coalesce(data->>'externalSource','') <> 'DroneLogbook';
create unique index aerolog_inventory_source_identity on public.aerolog_records(organization_id,kind,(data->>'externalSource'),(data->>'externalId'))
where kind in ('asset','battery') and data->>'externalId' is not null;
