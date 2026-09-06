import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichmentPatch } from '../lib/flight/enrichment';
import type { Flight } from '../lib/domain/models';
const samples = [0, 10].map((time) => ({
  time,
  longitude: 55,
  latitude: 25,
  altitude: 10,
}));
test('enrichment adds telemetry without accounting or track fields', () => {
  const patch = enrichmentPatch(
    { telemetry: [], durationSeconds: 600 } as unknown as Flight,
    { telemetry: samples, durationSeconds: 700 } as Flight,
  );
  assert.deepEqual(Object.keys(patch), ['telemetry']);
});
test('enrichment adds missing channels while retaining all original readings', () => {
  const patch = enrichmentPatch(
    { telemetry: samples } as Flight,
    { telemetry: samples.map((p) => ({ ...p, voltage: 24 })) } as Flight,
  );
  assert.equal(patch.telemetry[0].voltage, 24);
  assert.equal(patch.telemetry[0].altitude, 10);
});
test('enrichment rejects conflicting readings and changed start identity', () => {
  assert.throws(
    () =>
      enrichmentPatch(
        { telemetry: samples } as Flight,
        { telemetry: samples.map((p) => ({ ...p, altitude: 30 })) } as Flight,
      ),
    /conflicts/,
  );
  assert.throws(
    () =>
      enrichmentPatch(
        {
          telemetry: [],
          startedAt: '2026-09-06T00:00:00Z',
        } as unknown as Flight,
        { telemetry: samples, startedAt: '2026-09-06T01:00:00Z' } as Flight,
      ),
    /start times/,
  );
});
