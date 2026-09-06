import { z } from 'zod';
const name = z.string().trim().min(1).max(160),
  id = z.string().min(1).max(100),
  note = z.string().max(12000).default('');
const numeric = (min: number, max: number) => z.number().min(min).max(max);
const date = z.iso.date();
const point = z.tuple([numeric(-180, 180), numeric(-90, 90)]);
export const riskSchema = z.object({
  hazard: name,
  likelihood: numeric(1, 5).int(),
  severity: numeric(1, 5).int(),
  mitigation: note,
  controlled: z.boolean(),
  residualLikelihood: numeric(1, 5).int().optional(),
  residualSeverity: numeric(1, 5).int().optional(),
});
export const missionSchema = z.object({
  id,
  name,
  location: name,
  date,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: numeric(5, 720).int().default(60),
  type: name,
  status: z.enum([
    'Draft',
    'Pending approval',
    'Approved',
    'Changes requested',
    'Completed',
  ]),
  pilot: name,
  observer: name,
  aircraft: name,
  equipment: z.array(z.string().max(160)).max(100),
  notes: note,
  risks: z.array(riskSchema).max(50),
  history: z.array(z.string()).default([]),
  geometry: z.array(point).max(500).default([]),
  altitude: numeric(1, 500).default(60),
  reviewNote: note.optional(),
  debrief: note.optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
const inventorySourceFields = {
  externalSource: z.literal('DroneLogbook').optional(),
  externalId: z.string().max(100).optional(),
  sourceName: z.string().optional(),
  sourceStatus: z.union([z.string(), z.number()]).optional(),
  sourceRecord: z.record(z.string(), z.unknown()).optional(),
  sourceImportedAt: z.string().optional(),
};
export const assetSchema = z.object({
  ...inventorySourceFields,
  id,
  name,
  category: z.enum(['Aircraft', 'Payload', 'Controller', 'Accessory']),
  serial: z.string().max(160),
  status: z.enum([
    'Available',
    'Checked out',
    'Maintenance due',
    'Retired',
    'Unverified',
  ]),
  hours: numeric(0, 100000).nullable(),
  pilot: z.string().default('Unassigned'),
  next: numeric(1, 100000).nullable(),
  intervalHours: numeric(1, 10000).nullable().default(100),
  notes: note,
});
export const batterySchema = z.object({
  ...inventorySourceFields,
  id,
  model: name,
  aircraft: name,
  cycles: numeric(0, 100000).int(),
  health: numeric(0, 100).nullable(),
  temp: numeric(-50, 150).nullable(),
  status: z.enum([
    'Healthy',
    'Attention required',
    'Quarantined',
    'Retired',
    'Unverified',
  ]),
  serial: z.string().max(160).optional(),
  notes: note,
});
export const crewSchema = z.object({
  id,
  name,
  initials: z.string().max(5),
  role: name,
  hours: numeric(0, 100000).default(0),
  flights: numeric(0, 1000000).int().default(0),
  cert: name,
  expires: date,
  status: z.enum(['Available', 'Unavailable', 'Inactive']),
  email: z.email().optional().or(z.literal('')),
  authUserId: z.uuid().optional(),
  notes: note,
});
export const serviceSchema = z.object({
  id,
  asset: name,
  task: name,
  due: date,
  remaining: numeric(0, 10000).default(0),
  status: z.enum(['Scheduled', 'Upcoming', 'Overdue', 'Completed']),
  technician: name,
  notes: note,
  intervalHours: numeric(1, 10000).default(100),
  completionNotes: note.optional(),
  signedBy: z.string().optional(),
  completedAt: z.string().optional(),
});
export const batteryReadingSchema = z.object({
  serial: z.string().min(1).max(160),
  charge: numeric(0, 100).optional(),
  voltage: numeric(0, 100).optional(),
  temperature: numeric(-50, 150).optional(),
  currentAmps: numeric(-500, 500).optional(),
  remainingCapacityMah: numeric(0, 100000).optional(),
  fullCapacityMah: numeric(1, 100000).optional(),
  designCapacityMah: numeric(1, 100000).optional(),
  cellVoltages: z.array(numeric(0, 10)).min(1).max(24).optional(),
});
export const telemetrySchema = z.object({
  time: numeric(0, 86400),
  longitude: numeric(-180, 180),
  latitude: numeric(-90, 90),
  altitude: numeric(-1000, 10000),
  battery: numeric(0, 100).optional(),
  temperature: numeric(-50, 150).optional(),
  voltage: numeric(0, 100).optional(),
  speed: numeric(0, 150).optional(),
  currentAmps: numeric(-500, 500).optional(),
  remainingCapacityMah: numeric(0, 100000).optional(),
  fullCapacityMah: numeric(1, 100000).optional(),
  designCapacityMah: numeric(1, 100000).optional(),
  cellVoltages: z.array(numeric(0, 10)).min(1).max(24).optional(),
  batteryPacks: z.array(batteryReadingSchema).max(8).optional(),
});
export const flightSchema = z
  .object({
    id,
    sourceApp: z
      .enum(['DJI Fly', 'DJI GO 4', 'DJI Pilot 2', 'DJI FlightHub 2', 'Other'])
      .optional(),
    pilotUserId: z.uuid().optional(),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    aircraftSerial: z.string().max(160).optional(),
    batterySerials: z.array(z.string().min(1).max(160)).max(8).optional(),
    importProvenance: z
      .object({
        format: z.string().min(1).max(80),
        parserVersion: z.string().max(40),
        heightDatum: z.enum([
          'relativeToTakeoff',
          'relativeToGround',
          'absolute',
          'unspecified',
        ]),
        sampleCount: z.number().int().min(0).max(20000),
      })
      .optional(),
    aircraftId: id.optional(),
    equipmentIds: z.array(id).max(200).optional(),
    batteryIds: z.array(id).max(200).optional(),
    plannedBoundary: z.array(point).max(5000).optional(),
    // Untimed KML geometry is separate from timestamped telemetry.
    flightTrack: z
      .array(
        z.tuple([numeric(-180, 180), numeric(-90, 90), numeric(-1000, 10000)]),
      )
      .min(2)
      .max(20000)
      .optional(),
    siteLocation: point.optional(),
    siteName: z.string().max(300).optional(),
    equipmentNames: z.array(z.string().max(300)).max(200).optional(),
    mission: z.string().max(160),
    missionId: z.string().optional(),
    pilot: name,
    aircraft: name,
    date: z.union([date, z.literal('')]),
    duration: z.string(),
    durationSeconds: numeric(1, 86400),
    distance: z.string().regex(/^\d+(\.\d+)?$/),
    altitude: numeric(-1000, 10000),
    start: numeric(0, 100).nullable(),
    end: numeric(0, 100).nullable(),
    battery: z.string().max(160),
    peakTemperature: numeric(-50, 150).nullable().optional(),
    importHash: z.string().max(128).optional(),
    source: z
      .enum([
        'Manual',
        'CSV',
        'DJI JSON',
        'DJI flight record',
        'DroneLogbook API',
      ])
      .default('Manual'),
    telemetry: z.array(telemetrySchema).max(20000).default([]),
    notes: note,
  })
  .refine(
    (flight) => flight.date !== '' || flight.source === 'DroneLogbook API',
    {
      message:
        'A flight date is required except for undated historical API records',
      path: ['date'],
    },
  );
export const schemas = {
  mission: missionSchema,
  asset: assetSchema,
  battery: batterySchema,
  crew: crewSchema,
  service: serviceSchema,
  flight: flightSchema,
};
export type Kind = keyof typeof schemas;
export type Mission = z.infer<typeof missionSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Battery = z.infer<typeof batterySchema>;
export type Crew = z.infer<typeof crewSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Flight = z.infer<typeof flightSchema>;
export type Profile = {
  id: string;
  organization_id: string;
  display_name: string;
  role: 'admin' | 'manager' | 'pilot' | 'technician' | 'observer';
  active: boolean;
};
export type RecordEnvelope = {
  id: string;
  kind: Kind | 'battery_event' | 'attachment';
  data: any;
  revision: number;
  created_by: string;
  updated_at: string;
};
export function parseRecord(kind: Kind, data: unknown) {
  return schemas[kind].parse(data);
}
export function newId(prefix: string) {
  return prefix + '–' + crypto.randomUUID().slice(0, 8).toUpperCase();
}
export function durationLabel(seconds: number) {
  return (
    Math.floor(seconds / 60) +
    ':' +
    String(Math.round(seconds % 60)).padStart(2, '0')
  );
}
