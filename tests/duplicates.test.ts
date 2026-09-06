import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateMatches } from '../lib/flight/duplicates';
import type { Flight } from '../lib/domain/models';
const flight = {
  id: 'F1',
  aircraft: 'Drone',
  aircraftSerial: 'SN1',
  startedAt: '2026-09-06T12:00:00+04:00',
  date: '2026-09-06',
  durationSeconds: 600,
  distance: '1.5',
  importHash: 'abc',
} as Flight;
test('exact source hash wins despite changed assignment', () => {
  assert.equal(
    duplicateMatches({ ...flight, aircraft: 'Other' }, [flight])[0].kind,
    'exact',
  );
});
test('cross-format identity compares instants across time zones', () => {
  assert.equal(
    duplicateMatches(
      { ...flight, importHash: 'def', startedAt: '2026-09-06T08:00:00Z' },
      [flight],
    )[0].kind,
    'identity',
  );
});
test('similar totals are candidates, never exact matches', () => {
  assert.equal(
    duplicateMatches(
      {
        ...flight,
        importHash: 'def',
        startedAt: undefined,
        aircraftSerial: undefined,
      },
      [flight],
    )[0].kind,
    'possible',
  );
});
test('distinct flight totals are not candidates', () => {
  assert.equal(
    duplicateMatches(
      {
        ...flight,
        importHash: 'def',
        startedAt: undefined,
        durationSeconds: 100,
      },
      [flight],
    ).length,
    0,
  );
});
