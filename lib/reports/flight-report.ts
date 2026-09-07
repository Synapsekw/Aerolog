import { z } from 'zod';
export const reportRequestSchema = z
  .object({
    type: z.enum(['Organization', 'Pilot', 'Aircraft', 'Battery']),
    from: z.iso.date(),
    to: z.iso.date(),
    entityId: z.string().max(100).default(''),
  })
  .refine((r) => r.from <= r.to, 'Report end date must follow the start date')
  .refine(
    (r) => r.type === 'Organization' || r.entityId.length > 0,
    'Choose the pilot or equipment for this report',
  );
export type ReportRequest = z.infer<typeof reportRequestSchema>;
export type ReportRecord = {
  id: string;
  kind: string;
  revision: number;
  data: Record<string, any>;
};
export type ReportMember = { id: string; display_name: string };
export type FlightReport = {
  version: 1;
  request: ReportRequest;
  entityName: string;
  columns: string[];
  rows: (string | number)[][];
  flightCount: number;
  durationSeconds: number;
  distanceKm: number;
  undatedExcluded: number;
  unattributedPilots: number;
  sourceReferences: { kind: string; id: string; revision: number }[];
  notes: string[];
};
export function createFlightReport(
  request: ReportRequest,
  records: ReportRecord[],
  members: ReportMember[],
): FlightReport {
  const input = reportRequestSchema.parse(request),
    all = records.filter((r) => r.kind === 'flight');
  const entity =
    input.type === 'Pilot'
      ? members.find((m) => m.id === input.entityId)
      : input.type === 'Aircraft'
        ? records.find(
            (r) =>
              r.kind === 'asset' &&
              r.id === input.entityId &&
              r.data.category === 'Aircraft',
          )
        : input.type === 'Battery'
          ? records.find((r) => r.kind === 'battery' && r.id === input.entityId)
          : undefined;
  if (input.type !== 'Organization' && !entity)
    throw Error('Report entity is unavailable in this organization');
  const entityName = entity
    ? 'display_name' in entity
      ? entity.display_name
      : entity.data.name ||
        entity.data.sourceName ||
        entity.data.model ||
        entity.id
    : 'All organization flights';
  function pilotId(f: Record<string, any>) {
    if (f.pilotUserId) return f.pilotUserId;
    const candidates = members.filter((m) => m.display_name === f.pilot);
    return candidates.length === 1 ? candidates[0].id : undefined;
  }
  function matches(f: Record<string, any>) {
    if (input.type === 'Pilot') return pilotId(f) === input.entityId;
    if (input.type === 'Aircraft')
      return f.aircraftId
        ? f.aircraftId === input.entityId
        : f.aircraft === entityName;
    if (input.type === 'Battery')
      return [
        ...new Set([...(f.batteryIds || []), f.battery].filter(Boolean)),
      ].includes(input.entityId);
    return true;
  }
  const scope = all.filter((r) => matches(r.data)),
    selected = scope
      .filter(
        (r) =>
          r.data.date && r.data.date >= input.from && r.data.date <= input.to,
      )
      .sort(
        (a, b) =>
          a.data.date.localeCompare(b.data.date) || a.id.localeCompare(b.id),
      );
  for (const r of selected) {
    if (!Number.isFinite(r.data.durationSeconds) || r.data.durationSeconds <= 0)
      throw Error('Invalid recorded duration for ' + r.id);
    if (
      !Number.isFinite(Number(r.data.distance)) ||
      Number(r.data.distance) < 0
    )
      throw Error('Invalid recorded distance for ' + r.id);
  }
  const rows = selected.map((r) => [
    r.id,
    r.data.date,
    r.data.startedAt || '',
    r.data.mission || '',
    r.data.pilot,
    pilotId(r.data) || '',
    r.data.aircraft,
    r.data.aircraftId || '',
    r.data.durationSeconds,
    Number(r.data.distance),
    [
      ...new Set(
        [...(r.data.batteryIds || []), r.data.battery].filter(Boolean),
      ),
    ].join('; '),
    r.data.source || '',
    r.data.importHash || '',
    r.revision,
  ]);
  return {
    version: 1,
    request: input,
    entityName,
    columns: [
      'Flight ID',
      'Recorded date',
      'Start timestamp',
      'Mission',
      'Pilot name',
      'Pilot user ID',
      'Aircraft name',
      'Aircraft ID',
      'Duration seconds',
      'Distance km',
      'Battery IDs',
      'Source',
      'Import hash',
      'Record revision',
    ],
    rows,
    flightCount: selected.length,
    durationSeconds: selected.reduce((n, r) => n + r.data.durationSeconds, 0),
    distanceKm: selected.reduce((n, r) => n + Number(r.data.distance), 0),
    undatedExcluded: scope.filter((r) => !r.data.date).length,
    unattributedPilots: selected.filter(
      (r) => !pilotId(r.data) || !members.some((m) => m.id === pilotId(r.data)),
    ).length,
    sourceReferences: selected.map(({ id, kind, revision }) => ({
      id,
      kind,
      revision,
    })),
    notes: [
      'Dates are inclusive and use each flight’s recorded date. Undated flights are excluded.',
      'External flight-time entries are separate and are not included in these flight totals.',
      'Battery reports show linked flight usage; flight counts are not charge-cycle counts.',
      'Stable pilot/aircraft IDs take precedence over names. Ambiguous pilot names remain unattributed.',
    ],
  };
}
export function reportCsv(
  report: FlightReport,
  organization: string,
  generatedAt: string,
) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe =
      typeof value === 'string' && /^\s*[=+@\-\t\r]/.test(text)
        ? "'" + text
        : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const metadata: (string | number)[][] = [
    ['AeroLog flight report', report.request.type],
    ['Organization', organization],
    ['Entity', report.entityName],
    ['From', report.request.from],
    ['Through', report.request.to],
    ['Generated at', generatedAt],
    ['Calculation version', report.version],
    ['Flight count', report.flightCount],
    ['Duration seconds', report.durationSeconds],
    ['Distance km', report.distanceKm],
    ['Undated flights excluded', report.undatedExcluded],
    ['Unattributed pilot flights', report.unattributedPilots],
    ...report.notes.map((n) => ['Note', n]),
    [],
    report.columns,
    ...report.rows,
  ];
  return (
    '\uFEFF' +
    metadata.map((row) => row.map(cell).join(',')).join('\r\n') +
    '\r\n'
  );
}
