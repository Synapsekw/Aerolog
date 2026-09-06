import test from 'node:test';
import assert from 'node:assert/strict';
import { memberFlightTotals } from '../lib/domain/team';
import type { Profile, Flight } from '../lib/domain/models';
const members = [
  { id: 'one', display_name: 'Ivan', active: true },
  { id: 'two', display_name: 'Ivan', active: false },
  { id: 'three', display_name: 'Sara', active: true },
] as Profile[];
test('member accounting uses identity even for duplicate names and disabled members', () => {
  const flights = [
    { pilot: 'Old name', pilotUserId: 'two', durationSeconds: 60 },
    { pilot: 'Ivan', durationSeconds: 30 },
    { pilot: 'Sara', durationSeconds: 90 },
    { pilot: 'Sara', pilotUserId: 'external', durationSeconds: 120 },
  ] as Flight[];
  const totals = memberFlightTotals(members, flights);
  assert.deepEqual(totals.byId.get('two'), { flights: 1, seconds: 60 });
  assert.deepEqual(totals.byId.get('three'), { flights: 1, seconds: 90 });
  assert.deepEqual(totals.byId.get('one'), { flights: 0, seconds: 0 });
  assert.equal(totals.unattributed, 2);
});
