export type Sample = {
  longitude: number;
  latitude: number;
  altitude: number;
  time?: number;
  battery?: number;
  temperature?: number;
  voltage?: number;
  speed?: number;
  index: number;
  x: number;
};
export function flightSamples(flight: {
  telemetry?: any[];
  flightTrack?: number[][];
}) {
  const frames = flight.telemetry || [];
  const timed =
    frames.length > 1 &&
    frames.every(
      (p, i) =>
        Number.isFinite(p.time) && (i === 0 || p.time > frames[i - 1].time),
    );
  const raw =
    frames.length > 1
      ? frames
      : (flight.flightTrack || []).map((p) => ({
          longitude: p[0],
          latitude: p[1],
          altitude: p[2],
        }));
  const samples: Sample[] = raw.map((p, index) => ({
    ...p,
    index,
    x: timed ? p.time : index + 1,
  }));
  return { samples, timed };
}
export function nearestSample(samples: Sample[], x: number) {
  if (!samples.length) return -1;
  let lo = 0,
    hi = samples.length - 1;
  while (lo < hi) {
    const m = Math.floor((lo + hi) / 2);
    if (samples[m].x < x) lo = m + 1;
    else hi = m;
  }
  return lo > 0 &&
    Math.abs(samples[lo - 1].x - x) <= Math.abs(samples[lo].x - x)
    ? lo - 1
    : lo;
}
// Keep endpoints and extrema of each displayed channel, preserving source order.
export function chartSamples(samples: Sample[], buckets = 150) {
  if (samples.length <= buckets * 2) return samples;
  const selected = new Set([0, samples.length - 1]);
  const fields = [
    'altitude',
    'battery',
    'temperature',
    'voltage',
    'speed',
  ] as const;
  const size = Math.ceil(samples.length / buckets);
  // Keep both sides of missing-data boundaries so reduction cannot bridge a gap.
  for (let i = 1; i < samples.length; i++)
    for (const key of fields) {
      if (
        Number.isFinite(samples[i][key]) !==
        Number.isFinite(samples[i - 1][key])
      ) {
        selected.add(i - 1);
        selected.add(i);
      }
    }
  for (let a = 0; a < samples.length; a += size) {
    const b = Math.min(samples.length, a + size);
    for (const key of fields) {
      let min = -1,
        max = -1;
      for (let i = a; i < b; i++) {
        const v = samples[i][key];
        if (v == null || !Number.isFinite(v)) continue;
        if (min < 0 || v < samples[min][key]!) min = i;
        if (max < 0 || v > samples[max][key]!) max = i;
      }
      if (min >= 0) selected.add(min);
      if (max >= 0) selected.add(max);
    }
  }
  return [...selected].sort((a, b) => a - b).map((i) => samples[i]);
}
export function trackGeoJSON(
  samples: Sample[],
  name: string,
  heightDatum = 'unspecified',
) {
  // GeoJSON Z implies an absolute datum; source-relative heights stay in metadata.
  return {
    type: 'Feature',
    properties: {
      name,
      heightDatum,
      heightsMetres: samples.map((p) => p.altitude),
    },
    geometry: {
      type: 'LineString',
      coordinates: samples.map((p) => [p.longitude, p.latitude]),
    },
  };
}
