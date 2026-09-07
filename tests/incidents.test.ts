import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentSchema } from '../lib/operations/incidents';
const base = {
  id: 'incident',
  title: 'Observed damage',
  occurredAt: '2026-09-06T10:00:00Z',
  severity: 'Moderate',
  status: 'Reported',
  narrative: 'Damage observed after landing',
  actions: [
    {
      id: 'action',
      task: 'Inspect aircraft',
      done: false,
      completionNotes: '',
    },
  ],
};
test('incident closure requires resolution and completed follow-up actions', () => {
  assert.equal(incidentSchema.safeParse(base).success, true);
  assert.equal(
    incidentSchema.safeParse({
      ...base,
      status: 'Closed',
      resolution: 'Investigated and resolved',
    }).success,
    false,
  );
  assert.equal(
    incidentSchema.safeParse({
      ...base,
      status: 'Closed',
      resolution: 'Investigated and resolved',
      actions: [
        {
          ...base.actions[0],
          done: true,
          completionNotes: 'Inspection completed',
        },
      ],
    }).success,
    true,
  );
});
test('incident actions need unique IDs and completion evidence', () => {
  assert.equal(
    incidentSchema.safeParse({
      ...base,
      actions: [base.actions[0], base.actions[0]],
    }).success,
    false,
  );
  assert.equal(
    incidentSchema.safeParse({
      ...base,
      actions: [{ ...base.actions[0], done: true }],
    }).success,
    false,
  );
});
