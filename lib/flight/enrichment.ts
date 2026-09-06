import type { Flight } from '../domain/models';
// Add channels only at identical recorded positions/times. Never revise old readings.
export function enrichmentPatch(existing: Flight, incoming: Flight) {
  if (incoming.telemetry.length < 2)
    throw new Error('Enrichment requires at least two telemetry samples.');
  if (
    incoming.telemetry.some(
      (p, i) => i > 0 && p.time <= incoming.telemetry[i - 1].time,
    )
  )
    throw new Error('Telemetry sample times must increase.');
  const old = existing.telemetry || [];
  let telemetry = incoming.telemetry;
  if (old.length) {
    if (old.length !== incoming.telemetry.length)
      throw new Error(
        'Existing telemetry has different sampling. Retain both original files for manual review.',
      );
    telemetry = old.map((sample, index) => {
      const next = incoming.telemetry[index];
      for (const [key, value] of Object.entries(sample)) {
        if (
          key in next &&
          JSON.stringify(value) !== JSON.stringify((next as any)[key])
        )
          throw new Error(
            'Incoming telemetry conflicts with an existing reading. No readings were replaced.',
          );
      }
      if (
        sample.time !== next.time ||
        sample.longitude !== next.longitude ||
        sample.latitude !== next.latitude ||
        sample.altitude !== next.altitude
      )
        throw new Error('Sample positions differ.');
      return { ...next, ...sample };
    });
    if (JSON.stringify(telemetry) === JSON.stringify(old))
      throw new Error('This file adds no telemetry readings.');
  }
  if (
    existing.startedAt &&
    incoming.startedAt &&
    Date.parse(existing.startedAt) !== Date.parse(incoming.startedAt)
  )
    throw new Error('Flight start times conflict.');
  if (
    existing.aircraftSerial &&
    incoming.aircraftSerial &&
    existing.aircraftSerial !== incoming.aircraftSerial
  )
    throw new Error('Aircraft serials conflict.');
  return {
    telemetry,
    ...(!existing.startedAt && incoming.startedAt
      ? { startedAt: incoming.startedAt }
      : {}),
    ...(!existing.aircraftSerial && incoming.aircraftSerial
      ? { aircraftSerial: incoming.aircraftSerial }
      : {}),
    ...(!existing.batterySerials?.length && incoming.batterySerials?.length
      ? { batterySerials: incoming.batterySerials }
      : {}),
  };
}
