import {
  equipmentIdentityFamily,
  type EquipmentAlias,
} from '@/lib/domain/equipment-identity';
import type { ReportRecord } from '@/lib/reports/flight-report';
type Identity = { kind: 'asset' | 'battery'; id: string };
export function equipmentMergeReview(
  records: ReportRecord[],
  keep: Identity,
  duplicate: Identity,
  aliases: EquipmentAlias[] = [],
) {
  if (keep.kind !== duplicate.kind || keep.id === duplicate.id)
    throw Error('Choose two different records of the same equipment kind.');
  const a = records.find((r) => r.kind === keep.kind && r.id === keep.id),
    b = records.find((r) => r.kind === duplicate.kind && r.id === duplicate.id);
  if (!a || !b)
    throw Error('Both equipment records must belong to this organization.');
  const fields = [
    'name',
    'sourceName',
    'category',
    'serial',
    'manufacturer',
    'productModel',
    'model',
    'firmware',
    'status',
    'hours',
    'cycles',
    'health',
    'temp',
    'storageSiteId',
    'source',
    'externalId',
  ];
  const differences = fields
    .map((field) => ({
      field,
      keep: a.data[field] ?? null,
      duplicate: b.data[field] ?? null,
    }))
    .filter((r) => r.keep !== r.duplicate);
  const conflicts: string[] = [];
  if (a.kind === 'asset' && a.data.category !== b.data.category)
    conflicts.push('Different equipment categories');
  if (
    a.data.serial &&
    b.data.serial &&
    a.data.serial.trim() !== b.data.serial.trim()
  )
    conflicts.push('Different recorded serial numbers');
  const familyIds = new Set([
    ...equipmentIdentityFamily(keep, aliases).ids,
    ...equipmentIdentityFamily(duplicate, aliases).ids,
  ]);
  const familyRecords = records.filter(
    (r) => r.kind === keep.kind && familyIds.has(r.id),
  );
  if (
    new Set(
      familyRecords
        .map((r) => String(r.data.serial || '').trim())
        .filter(Boolean),
    ).size > 1 &&
    !conflicts.includes('Different recorded serial numbers')
  )
    conflicts.push('Conflicting serial numbers in retained source records');
  if (
    keep.kind === 'asset' &&
    new Set(familyRecords.map((r) => r.data.category)).size > 1 &&
    !conflicts.includes('Different equipment categories')
  )
    conflicts.push(
      'Conflicting equipment categories in retained source records',
    );
  function references(target: ReportRecord) {
    const { kind, id, data } = target,
      name = data.name;
    const plans = records
      .filter(
        (r) =>
          r.kind === 'inspection_plan' &&
          r.data.targetKind === kind &&
          r.data.targetId === id,
      )
      .map((r) => r.id);
    return records
      .filter((r) => {
        const d = r.data;
        const typed = (x: any) => x?.kind === kind && x?.id === id;
        if (r.kind === 'flight')
          return kind === 'battery'
            ? d.battery === id || d.batteryIds?.includes(id)
            : d.aircraftId === id ||
                d.equipmentIds?.includes(id) ||
                (!d.aircraftId &&
                  !d.equipmentIds?.length &&
                  name &&
                  d.aircraft === name);
        if (r.kind === 'mission')
          return (
            d.equipment?.includes(id) ||
            (kind === 'asset' &&
              name &&
              (d.aircraft === name ||
                d.additionalAircraft?.includes(name) ||
                d.equipment?.includes(name))) ||
            d.kitSnapshots?.some((k: any) => k.items?.some(typed))
          );
        if (r.kind === 'kit') return d.items?.some(typed);
        if (r.kind === 'service')
          return d.targetId
            ? d.targetKind === kind && d.targetId === id
            : kind === 'asset' && name && d.asset === name;
        if (r.kind === 'inspection_event') return plans.includes(d.planId);
        if (r.kind === 'battery_reading')
          return kind === 'battery' && d.batteryId === id;
        if (r.kind === 'battery_event')
          return kind === 'battery' && d.battery === id;
        if (r.kind === 'crew')
          return kind === 'asset' && d.authorizedAircraftIds?.includes(id);
        if (r.kind === 'document')
          return d.targetId === id && d.targetKind === kind;
        return (
          (d.targetKind === kind && d.targetId === id) ||
          d.equipment?.some?.(typed)
        );
      })
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        revision: r.revision,
        status: r.data.status || '',
        name: r.data.name || r.data.task || r.data.title || r.id,
      }));
  }
  function familyReferences(identity: Identity) {
    const ids = new Set(equipmentIdentityFamily(identity, aliases).ids);
    const refs = records
      .filter((r) => r.kind === identity.kind && ids.has(r.id))
      .flatMap(references);
    return [...new Map(refs.map((r) => [r.kind + ':' + r.id, r])).values()];
  }
  return {
    keep: a,
    duplicate: b,
    differences,
    conflicts,
    keepReferences: familyReferences(keep),
    duplicateReferences: familyReferences(duplicate),
  };
}
