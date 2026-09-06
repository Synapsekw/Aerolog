// Independent adapter for the documented column names in Airdata telemetry CSV.
// Unit suffixes are required for dimensional readings; unknown units are rejected.
export function isTelemetryCSV(row: Record<string, string>) {
  const keys = Object.keys(row).map((k) => k.toLowerCase());
  return keys.includes('time(millisecond)') && keys.includes('datetime(utc)');
}
export function telemetryCSV(rows: Record<string, string>[]) {
  if (rows.length < 2 || rows.length > 20000)
    throw new Error(
      'Telemetry CSV requires 2–20,000 samples. Split larger logs without dropping readings.',
    );
  const columns = new Map<string, { key: string; unit: string }>();
  for (const key of Object.keys(rows[0])) {
    const match = key
      .trim()
      .toLowerCase()
      .match(/^([^()]+?)(?:\(([^)]+)\))?$/);
    if (!match) continue;
    const base = match[1].trim();
    if (columns.has(base))
      throw new Error('Ambiguous duplicate telemetry column: ' + base);
    columns.set(base, { key, unit: match[2]?.trim() || '' });
  }
  const read = (
    row: Record<string, string>,
    base: string,
    units: Record<string, number | ((v: number) => number)>,
  ) => {
    const col = columns.get(base);
    if (!col || row[col.key]?.trim() === '') return undefined;
    const n = Number(row[col.key]);
    if (!Number.isFinite(n))
      throw new Error('Invalid numeric telemetry reading: ' + base);
    const convert = units[col.unit];
    if (convert === undefined)
      throw new Error(
        'Unsupported unit for ' + base + ': ' + (col.unit || 'missing'),
      );
    return typeof convert === 'function' ? convert(n) : n * convert;
  };
  const scalar = { '': 1 },
    degrees = { '': 1, degrees: 1 },
    lengths = { m: 1, meters: 1, feet: 0.3048, ft: 0.3048 };
  const samples = rows.map((row) => ({
    time: read(row, 'time', { millisecond: 0.001 }),
    latitude: read(row, 'latitude', degrees),
    longitude: read(row, 'longitude', degrees),
    altitude: read(row, 'altitude', lengths),
    speed: read(row, 'speed', {
      'm/s': 1,
      'km/h': 1 / 3.6,
      mph: 0.44704,
      knots: 0.5144444444,
    }),
    battery: read(row, 'battery_percent', scalar),
    voltage: read(row, 'voltage', { '': 1, v: 1, volts: 1 }),
    temperature: read(row, 'battery_temperature', {
      c: 1,
      celsius: 1,
      f: (v: number) => ((v - 32) * 5) / 9,
      fahrenheit: (v: number) => ((v - 32) * 5) / 9,
    }),
  }));
  if (
    samples.some(
      (p, i) =>
        p.time == null ||
        p.latitude == null ||
        p.longitude == null ||
        p.altitude == null ||
        (i > 0 && p.time <= samples[i - 1].time!),
    )
  )
    throw new Error(
      'Telemetry needs valid positions, height and strictly increasing sample times.',
    );
  const datetime = rows[0][columns.get('datetime')!.key].trim();
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(datetime))
    throw new Error('datetime(utc) must use YYYY-MM-DD HH:mm:ss.');
  const startedAt = datetime.replace(' ', 'T').replace(/Z?$/, 'Z');
  // Sum observed horizontal distances; this is distinct from distance to home.
  let metres = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      rad = Math.PI / 180;
    const dlat = (b.latitude! - a.latitude!) * rad,
      dlon = (b.longitude! - a.longitude!) * rad;
    const hav =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a.latitude! * rad) *
        Math.cos(b.latitude! * rad) *
        Math.sin(dlon / 2) ** 2;
    metres += 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, hav)));
  }
  const temps = samples.flatMap((s) =>
    s.temperature == null ? [] : [s.temperature],
  );
  return {
    date: startedAt.slice(0, 10),
    startedAt,
    durationSeconds: samples.at(-1)!.time! - samples[0].time!,
    distanceMeters: metres,
    altitude: Math.max(...samples.map((p) => p.altitude!)),
    start: samples[0].battery,
    end: samples.at(-1)!.battery,
    peakTemperature: temps.length ? Math.max(...temps) : undefined,
    telemetry: samples,
    importProvenance: {
      format: 'Airdata telemetry CSV',
      parserVersion: 'aerolog-1',
      heightDatum: 'unspecified',
      sampleCount: samples.length,
    },
    notes:
      'Telemetry CSV. Distance is calculated from recorded GPS positions. Height datum was not specified by the export.',
  };
}
