import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crewCanBeAssigned,
  missionAircraft,
  missionOverlaps,
} from '../lib/operations/assignments';
import type { Crew, Profile } from '../lib/domain/models';
test('disabled members are excluded even when historical crew remains available', () => {
  const crew = { name: 'Ivan', authUserId: 'u', status: 'Available' } as Crew;
  assert.equal(
    crewCanBeAssigned(crew, [
      { id: 'u', display_name: 'Renamed', active: false } as Profile,
    ]),
    false,
  );
  assert.equal(
    crewCanBeAssigned({ ...crew, authUserId: undefined }, [
      { display_name: 'Ivan', active: false } as Profile,
    ]),
    false,
  );
  assert.equal(
    crewCanBeAssigned(crew, [{ id: 'u', active: true } as Profile]),
    true,
  );
});
test('mission aircraft and adjacent time windows retain distinct resources', () => {
  assert.deepEqual(
    missionAircraft({ aircraft: 'A', additionalAircraft: ['B', 'A'] }),
    ['A', 'B'],
  );
  const a = { date: '2026-09-07', time: '23:30', durationMinutes: 60 };
  assert.equal(
    missionOverlaps(a, {
      date: '2026-09-08',
      time: '00:00',
      durationMinutes: 60,
    }),
    true,
  );
  assert.equal(
    missionOverlaps(a, {
      date: '2026-09-08',
      time: '00:30',
      durationMinutes: 60,
    }),
    false,
  );
});
