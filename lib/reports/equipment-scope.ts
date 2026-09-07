import {
  equipmentIdentityFamily,
  type EquipmentAlias,
} from '@/lib/domain/equipment-identity';
import type { ReportRecord } from './flight-report';
export function reportEquipmentScope(
  kind: 'asset' | 'battery',
  id: string,
  records: ReportRecord[],
  aliases: EquipmentAlias[] = [],
) {
  const family = equipmentIdentityFamily({ kind, id }, aliases),
    ids = new Set(family.ids);
  const names = new Set(
    records
      .filter((r) => r.kind === kind && ids.has(r.id))
      .map((r) => r.data.name)
      .filter(Boolean),
  );
  const legacyName = (name: unknown) =>
    typeof name === 'string' &&
    names.has(name) &&
    records
      .filter((r) => r.kind === kind && r.data.name === name)
      .every((r) => ids.has(r.id));
  return { ids, legacyName, consolidated: ids.size > 1 };
}
