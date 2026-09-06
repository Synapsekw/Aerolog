import test from 'node:test';
import assert from 'node:assert/strict';
import { flightSchema } from '../lib/domain/models';
const record = {
  id: 'DLB-test', mission: 'Historical flight', pilot: 'Test Pilot', aircraft: 'Imported aircraft',
  date: '', duration: '10:00', durationSeconds: 600, distance: '1', altitude: 40,
  start: null, end: null, battery: '', source: 'DroneLogbook API', telemetry: [], notes: '',
};
test('undated API history remains undated and cannot masquerade as a dated manual flight', () => {
  assert.equal(flightSchema.parse(record).date, '');
  assert.equal(flightSchema.safeParse({...record, source: 'Manual'}).success, false);
  assert.equal(flightSchema.safeParse({...record, date: '0000-00-00'}).success, false);
});
test('planned geometry is separate from actual position telemetry and validates coordinate bounds', () => {
  const parsed = flightSchema.parse({...record, plannedBoundary: [[47, 28], [48, 28], [48, 29]], siteLocation: [47, 28]});
  assert.equal(parsed.telemetry.length, 0);
  assert.equal(parsed.plannedBoundary?.length, 3);
  assert.equal(flightSchema.safeParse({...record, siteLocation: [200, 28]}).success, false);
});
