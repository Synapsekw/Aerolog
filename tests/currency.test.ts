import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currencySummary,
  currencyPolicySchema,
} from '../lib/operations/currency';
test('recency uses the preceding days and keeps external totals distinct', () => {
  const p = {
    name: 'Pilot',
    authUserId: 'user',
    currencyPolicy: {
      enabled: true,
      days: 2,
      minimumFlights: 2,
      minimumMinutes: 30,
      includeExternal: false,
    },
    externalTime: [{ date: '2026-09-06', flights: 1, minutes: 20 }],
  };
  const flights = [
    { date: '2026-09-05', pilotUserId: 'user', durationSeconds: 600 },
    { date: '2026-09-04', pilot: 'Pilot', durationSeconds: 600 },
    { date: '2026-09-07', pilot: 'Pilot', durationSeconds: 600 },
    { date: '', pilot: 'Pilot', durationSeconds: 600 },
    {
      date: '2026-09-06',
      pilotUserId: 'another',
      pilot: 'Pilot',
      durationSeconds: 600,
    },
  ];
  const result = currencySummary(p, flights, '2026-09-07');
  assert.equal(result.localFlights, 1);
  assert.equal(result.externalFlights, 1);
  assert.equal(result.met, false);
  const enabled = currencySummary(
    { ...p, currencyPolicy: { ...p.currencyPolicy, includeExternal: true } },
    flights,
    '2026-09-07',
  );
  assert.equal(enabled.met, true);
  assert.equal(enabled.minutes, 30);
  assert.equal(enabled.localFlights, 1);
});
test('enabled recency policy needs a positive requirement', () =>
  assert.equal(
    currencyPolicySchema.safeParse({
      enabled: true,
      days: 30,
      minimumFlights: 0,
      minimumMinutes: 0,
      includeExternal: false,
    }).success,
    false,
  ));
