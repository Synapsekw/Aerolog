import type { Flight } from '@/lib/domain/models';
export function flightLocation(f: Flight): [number, number] | undefined {
  const p = f.telemetry?.[0];
  const coordinate = p
    ? [p.longitude, p.latitude]
    : f.flightTrack?.[0] || f.siteLocation;
  if (
    !coordinate ||
    !Number.isFinite(coordinate[0]) ||
    !Number.isFinite(coordinate[1]) ||
    Math.abs(coordinate[0]) > 180 ||
    Math.abs(coordinate[1]) > 90
  )
    return undefined;
  return [coordinate[0], coordinate[1]];
}
