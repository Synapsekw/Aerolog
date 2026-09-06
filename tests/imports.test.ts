import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextImport } from '../lib/domain/imports';
void test('CSV uses seconds and kilometres, preserves quoted notes and unknown battery charge', () => {
  const r = parseTextImport(
    'date,durationSeconds,distanceKm,notes\n2026-09-06,125,1.25,"wind, light"\n',
    'csv',
  ).flights[0];
  assert.equal(r.duration, '2:05');
  assert.equal(r.distance, '1.25');
  assert.equal(r.notes, 'wind, light');
  assert.equal(r.start, null);
});
void test('duplicate source records have deterministic hashes independent of generated IDs', () => {
  const csv = 'date,durationSeconds\n2026-09-06,100';
  const a = parseTextImport(csv, 'csv').flights[0],
    b = parseTextImport(csv, 'csv').flights[0];
  assert.equal(a.importHash, b.importHash);
  assert.notEqual(a.id, b.id);
});
void test('invalid flight durations fail instead of reducing fleet hours', () => {
  assert.throws(() =>
    parseTextImport('date,durationSeconds\n2026-09-06,-100', 'csv'),
  );
  assert.throws(() =>
    parseTextImport('date,durationSeconds\n2026-02-30,100', 'csv'),
  );
});
void test('normalized JSON converts metres and preserves telemetry', () => {
  const r = parseTextImport(
    JSON.stringify({
      date: '2026-09-06',
      durationSeconds: 120,
      distanceMeters: 2500,
      telemetry: [
        { time: 1, longitude: 55, latitude: 25, altitude: 60, battery: 80 },
      ],
    }),
    'json',
  ).flights[0];
  assert.equal(r.distance, '2.5');
  assert.equal(r.telemetry[0].battery, 80);
});
