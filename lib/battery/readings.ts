import { z } from 'zod';
const optionalNumber = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();
export const batteryReadingRecordSchema = z
  .object({
    id: z.string().min(1).max(100),
    batteryId: z.string().min(1).max(100),
    measuredAt: z.iso.datetime({ offset: true }),
    source: z.enum([
      'Device reading',
      'Manual measurement',
      'Imported baseline',
    ]),
    deviceCycles: optionalNumber(0, 100000).refine(
      (v) => v == null || Number.isInteger(v),
    ),
    charge: optionalNumber(0, 100),
    health: optionalNumber(0, 100),
    temperature: optionalNumber(-50, 150),
    voltage: optionalNumber(0, 100),
    fullCapacityMah: optionalNumber(1, 100000),
    designCapacityMah: optionalNumber(1, 100000),
    notes: z.string().trim().min(5).max(12000),
    applyToRegister: z.boolean().default(false),
  })
  .superRefine((r, c) => {
    if (
      [
        r.deviceCycles,
        r.charge,
        r.health,
        r.temperature,
        r.voltage,
        r.fullCapacityMah,
        r.designCapacityMah,
      ].every((v) => v == null)
    )
      c.addIssue({
        code: 'custom',
        message: 'Record at least one measured value',
      });
    if (
      r.applyToRegister &&
      r.deviceCycles == null &&
      r.health == null &&
      r.temperature == null
    )
      c.addIssue({
        code: 'custom',
        message: 'Register updates require cycles, health or temperature',
      });
  });
export type BatteryReadingRecord = z.infer<
  typeof batteryReadingRecordSchema
> & { recordedBy?: string; recordedAt?: string };
export function capacityRatio(
  reading: Pick<BatteryReadingRecord, 'fullCapacityMah' | 'designCapacityMah'>,
) {
  return reading.fullCapacityMah != null && reading.designCapacityMah != null
    ? (100 * reading.fullCapacityMah) / reading.designCapacityMah
    : null;
}
export function latestDeviceCycles(readings: BatteryReadingRecord[]) {
  return (
    readings
      .filter((r) => r.deviceCycles != null && r.source === 'Device reading')
      .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0]
      ?.deviceCycles ?? null
  );
}
