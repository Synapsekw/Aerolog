import {
  equipmentIdentityFamily,
  type EquipmentAlias,
  type EquipmentIdentity,
} from './equipment-identity';
/** Read-only history projection. Keep every source record and counter intact. */
export function equipmentPassportHistory(
  identity: EquipmentIdentity,
  aliases: EquipmentAlias[],
  items: (kind: string) => any[],
) {
  const family = equipmentIdentityFamily(identity, aliases);
  const ids = new Set(family.ids);
  const inventory = items(identity.kind);
  const sources = inventory.filter((record) => ids.has(record.id));
  // A legacy name is usable only when it identifies one equipment family.
  const legacyMatch = (name: unknown) => {
    if (identity.kind !== 'asset' || typeof name !== 'string' || !name.trim())
      return false;
    const matches = inventory.filter((record) => record.name === name);
    return matches.length > 0 && matches.every((record) => ids.has(record.id));
  };
  const typedMatch = (record: any) =>
    record.targetKind === identity.kind && ids.has(record.targetId);
  const flights = items('flight')
    .filter((flight) =>
      identity.kind === 'battery'
        ? ids.has(flight.battery) ||
          flight.batteryIds?.some((id: string) => ids.has(id))
        : ids.has(flight.aircraftId) ||
          flight.equipmentIds?.some((id: string) => ids.has(id)) ||
          (!flight.aircraftId &&
            !flight.equipmentIds?.length &&
            legacyMatch(flight.aircraft)),
    )
    .sort((a, b) =>
      String(b.startedAt || b.date || '').localeCompare(
        String(a.startedAt || a.date || ''),
      ),
    );
  const plans = items('inspection_plan').filter(typedMatch);
  const planIds = new Set(plans.map((plan) => plan.id));
  return {
    ...family,
    sources,
    flights,
    files: items('attachment').filter(typedMatch),
    services: items('service').filter((service) =>
      service.targetId ? typedMatch(service) : legacyMatch(service.asset),
    ),
    plans,
    events: items('inspection_event').filter((event) =>
      planIds.has(event.planId),
    ),
    batteryEvents:
      identity.kind === 'battery'
        ? items('battery_event').filter((event) => ids.has(event.battery))
        : [],
  };
}
