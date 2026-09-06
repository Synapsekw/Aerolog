import type { Flight } from '../domain/models';
export type DuplicateMatch = {
  flight: Flight;
  kind: 'exact' | 'identity' | 'possible';
  reason: string;
};
export function duplicateMatches(
  incoming: Flight,
  existing: Flight[],
): DuplicateMatch[] {
  return existing.flatMap<DuplicateMatch>((f) => {
    if (
      incoming.importHash &&
      (incoming.importHash === f.importHash ||
        (
          f as Flight & { enrichmentHashes?: string[] }
        ).enrichmentHashes?.includes(incoming.importHash))
    )
      return [
        {
          flight: f,
          kind: 'exact' as const,
          reason: 'Identical source record hash',
        },
      ];
    const sameSerial =
      !!incoming.aircraftSerial && incoming.aircraftSerial === f.aircraftSerial;
    const sameTime =
      !!incoming.startedAt &&
      !!f.startedAt &&
      Date.parse(incoming.startedAt) === Date.parse(f.startedAt);
    if (sameSerial && sameTime)
      return [
        {
          flight: f,
          kind: 'identity' as const,
          reason: 'Same aircraft serial and exact start time',
        },
      ];
    const sameAircraft =
      sameSerial ||
      (incoming.aircraft !== 'Assign aircraft' &&
        incoming.aircraft === f.aircraft);
    if (
      sameAircraft &&
      incoming.date &&
      incoming.date === f.date &&
      Math.abs(incoming.durationSeconds - f.durationSeconds) <= 2 &&
      Math.abs(Number(incoming.distance) - Number(f.distance)) <= 0.02
    )
      return [
        {
          flight: f,
          kind: 'possible' as const,
          reason:
            'Same date and aircraft, similar duration and distance; exact identity unavailable',
        },
      ];
    return [];
  });
}
