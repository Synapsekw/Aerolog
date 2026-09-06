import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { flightSchema, durationLabel, type Flight } from './models';
export const CSV_HEADERS = [
  'date',
  'pilot',
  'aircraft',
  'durationSeconds',
  'distanceKm',
  'altitude',
  'battery',
  'start',
  'end',
  'mission',
  'notes',
];
export function normalizeImport(
  input: unknown,
  source: Flight['source'],
  hash: string,
): Flight {
  const d = input as Record<string, any>;
  const seconds = Number(d.durationSeconds);
  return flightSchema.parse({
    id: 'FL-' + randomUUID().slice(0, 8).toUpperCase(),
    mission: d.mission || 'Imported flight',
    missionId: d.missionId || undefined,
    pilot: d.pilot || 'Assign pilot',
    aircraft: d.aircraft || 'Assign aircraft',
    date: d.date,
    duration: durationLabel(seconds),
    durationSeconds: seconds,
    distance: String(
      d.distanceKm ??
        (d.distanceMeters !== undefined
          ? Number(d.distanceMeters) / 1000
          : (d.distance ?? 0)),
    ),
    altitude: Number(d.altitude ?? 0),
    start: d.start == null || d.start === '' ? null : Number(d.start),
    end: d.end == null || d.end === '' ? null : Number(d.end),
    battery: d.battery || '',
    peakTemperature:
      d.peakTemperature == null ? null : Number(d.peakTemperature),
    source,
    importHash: hash,
    telemetry: d.telemetry || [],
    notes: d.notes || '',
  });
}
export function parseTextImport(
  content: string,
  extension: string,
): { flights: Flight[]; warnings: string[] } {
  let records: unknown[];
  let source: Flight['source'];
  if (extension === 'csv') {
    records = parse(content, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 100000,
    });
    source = 'CSV';
    if (
      !records.length ||
      !['date', 'durationSeconds'].every((k) => k in (records[0] as object))
    )
      throw new Error(
        'CSV requires date (YYYY-MM-DD) and durationSeconds columns. Download the template for all supported columns.',
      );
  } else {
    const parsed = JSON.parse(content);
    records = Array.isArray(parsed) ? parsed : parsed.flights || [parsed];
    source = 'DJI JSON';
  }
  if (!Array.isArray(records) || !records.length || records.length > 500)
    throw new Error('Import between 1 and 500 flights per file.');
  const flights = records.map((record, index) => {
    try {
      return normalizeImport(
        record,
        source,
        createHash('sha256').update(JSON.stringify(record)).digest('hex'),
      );
    } catch {
      throw new Error(
        'Flight ' +
          (index + 1) +
          ' has invalid fields. Use the provided CSV template or normalized JSON format.',
      );
    }
  });
  return {
    flights,
    warnings: [
      'Review the pilot, aircraft and battery assignments before saving. CSV distances are in kilometres; telemetry uses seconds, metres, degrees Celsius and volts.',
    ],
  };
}
