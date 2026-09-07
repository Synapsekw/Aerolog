import type { EquipmentAlias } from '@/lib/domain/equipment-identity';
import { reportEquipmentScope } from './equipment-scope';
import type { ReportRecord, ReportRequest } from './flight-report';
export function equipmentHistory(
  request: ReportRequest,
  records: ReportRecord[],
  aliases: EquipmentAlias[] = [],
) {
  const kind = request.type === 'Battery' ? 'battery' : 'asset';
  const entity = records.find(
    (r) => r.kind === kind && r.id === request.entityId,
  );
  if (!entity || !['Aircraft', 'Battery'].includes(request.type))
    throw Error('Equipment history requires an aircraft or battery');
  const scope = reportEquipmentScope(kind, entity.id, records, aliases);
  const plans = records.filter(
    (r) =>
      r.kind === 'inspection_plan' &&
      r.data.targetKind === kind &&
      scope.ids.has(r.data.targetId),
  );
  const dateOf = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : Number.isFinite(Date.parse(value))
        ? new Date(value).toISOString().slice(0, 10)
        : '';
  let undatedExcluded = 0;
  const references: { kind: string; id: string; revision: number }[] = [];
  const rows: (string | number)[][] = [];
  for (const record of records) {
    const d = record.data;
    let planReference: ReportRecord | undefined;
    let date = '',
      basis = '',
      description = '',
      state = '',
      actor = '',
      cost: string | number = '',
      currency = '';
    if (
      record.kind === 'service' &&
      (d.targetId
        ? d.targetKind === kind && scope.ids.has(d.targetId)
        : kind === 'asset' &&
          (scope.consolidated
            ? scope.legacyName(d.asset)
            : d.asset === entity.data.name))
    ) {
      date = d.completedAt || d.due;
      basis = d.completedAt ? 'Completion date (UTC)' : 'Scheduled due date';
      description = d.task;
      state = d.status;
      actor = d.signedBy || d.technician || '';
      cost = d.cost ?? '';
      currency = d.currency || '';
    } else if (
      record.kind === 'inspection_event' &&
      plans.some((p) => p.id === d.planId)
    ) {
      const plan = plans.find((p) => p.id === d.planId)!;
      const rule = plan.data.profileSnapshot?.rules?.find(
        (r: any) => r.id === d.ruleId,
      );
      date = d.date;
      basis = 'Inspection date';
      description =
        (rule?.action || 'Inspection') + ' · ' + (rule?.name || d.ruleId);
      state = d.findings || '';
      actor = d.signedBy || '';
      planReference = plan;
    } else if (
      kind === 'battery' &&
      record.kind === 'battery_reading' &&
      scope.ids.has(d.batteryId)
    ) {
      date = d.measuredAt;
      basis = 'Measurement date (UTC)';
      description = 'Battery reading · ' + (d.source || 'Unknown source');
      state = [
        'deviceCycles',
        'charge',
        'health',
        'temperature',
        'voltage',
        'fullCapacityMah',
        'designCapacityMah',
      ]
        .filter((k) => d[k] != null)
        .map((k) => k + ': ' + d[k])
        .join(' · ');
      actor = d.recordedBy || '';
    } else if (
      kind === 'battery' &&
      record.kind === 'battery_event' &&
      scope.ids.has(d.battery)
    ) {
      date = d.date;
      basis = 'Charge event date (UTC)';
      description = 'Recorded charge cycle';
      state =
        d.cycles == null
          ? 'Counter unknown'
          : 'Absolute cycle counter: ' + d.cycles;
      actor = d.signedBy || '';
    } else continue;
    date = dateOf(date || '');
    if (!date) {
      undatedExcluded++;
      continue;
    }
    if (date < request.from || date > request.to) continue;
    if (planReference)
      references.push({
        kind: planReference.kind,
        id: planReference.id,
        revision: planReference.revision,
      });
    rows.push([
      date,
      basis,
      record.kind,
      record.id,
      description,
      state,
      actor,
      cost,
      currency,
      record.revision,
    ]);
    references.push({
      kind: record.kind,
      id: record.id,
      revision: record.revision,
    });
  }
  rows.sort(
    (a, b) =>
      String(a[0]).localeCompare(String(b[0])) ||
      String(a[3]).localeCompare(String(b[3])),
  );
  return {
    columns: [
      'Date',
      'Date basis',
      'Record type',
      'Record ID',
      'Work / event',
      'Status / reading',
      'Actor / technician',
      'Recorded cost',
      'Currency',
      'Revision',
    ],
    rows,
    undatedExcluded,
    sourceReferences: [
      ...new Map(references.map((r) => [r.kind + ':' + r.id, r])).values(),
    ],
  };
}
