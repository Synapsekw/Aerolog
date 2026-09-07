import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectionDue,
  inspectionProfileSchema,
  type InspectionPlan,
  type InspectionEvent,
} from '../lib/operations/inspections';
const profile = inspectionProfileSchema.parse({
  id: 'P',
  name: 'Airframe',
  model: 'M350',
  rules: [
    {
      id: 'R',
      name: 'Inspect',
      action: 'Inspect',
      hours: 10,
      flights: 20,
      cycles: null,
      days: 30,
    },
  ],
});
const plan = {
  id: 'PLAN',
  profileSnapshot: profile,
  baselineDate: '2026-09-01',
  baseline: { hours: 100, flights: 200, cycles: null },
} as InspectionPlan;
test('inspection becomes due when any interval is reached', () => {
  assert.equal(
    inspectionDue(
      plan,
      [],
      { hours: 109, flights: 220, cycles: null },
      '2026-09-02',
    )[0].status,
    'Due',
  );
  assert.equal(
    inspectionDue(
      plan,
      [],
      { hours: 101, flights: 201, cycles: null },
      '2026-10-01',
    )[0].status,
    'Due',
  );
});
test('missing or decreasing meters cannot imply remaining service life', () => {
  assert.equal(
    inspectionDue(
      plan,
      [],
      { hours: null, flights: 201, cycles: null },
      '2026-09-02',
    )[0].status,
    'Needs counters',
  );
  assert.equal(
    inspectionDue(
      plan,
      [],
      { hours: 99, flights: 201, cycles: null },
      '2026-09-02',
    )[0].status,
    'Needs counters',
  );
});
test('signed event resets only its own rule baseline', () => {
  const e = {
    id: 'E',
    planId: 'PLAN',
    ruleId: 'R',
    date: '2026-09-02',
    meters: { hours: 110, flights: 220, cycles: null },
  } as InspectionEvent;
  const due = inspectionDue(
    plan,
    [e],
    { hours: 111, flights: 222, cycles: null },
    '2026-09-03',
  )[0];
  assert.equal(due.status, 'Within limits');
  assert.equal(due.limits[0].remaining, 9);
});
test('empty inspection intervals are rejected', () => {
  assert.equal(
    inspectionProfileSchema.safeParse({
      ...profile,
      rules: [{ ...profile.rules[0], hours: null, flights: null, days: null }],
    }).success,
    false,
  );
});
