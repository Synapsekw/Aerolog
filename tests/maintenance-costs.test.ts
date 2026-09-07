import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceCosts } from '../lib/reports/maintenance-costs';
const row = (cost: string | number, currency = 'AED', status = 'Completed', kind = 'service') => ['', '', kind, 'id', '', status, '', cost, currency, 1];

test('maintenance costs separate currencies and open work while summing decimal amounts exactly', () => {
  const result = maintenanceCosts([row(0.1), row(0.2), row(10, 'AED', 'In progress'), row(1.234, 'KWD'), row(0.001, 'KWD'), row(0, 'KWD')]);
  assert.deepEqual(result.totals, [
    { currency: 'AED', completed: '0.3', open: '10', completedCount: 2, openCount: 1 },
    { currency: 'KWD', completed: '1.235', open: '0', completedCount: 3, openCount: 0 },
  ]);
});

test('missing costs are not zero, invalid currencies are not combined, non-services excluded', () => {
  const result = maintenanceCosts([row(''), row(-1), row(2, ''), row(20, 'AED', 'Completed', 'battery_reading'), row(0)]);
  assert.equal(result.serviceCount, 4);
  assert.equal(result.missingCost, 1);
  assert.equal(result.invalidCost, 1);
  assert.equal(result.missingCurrency, 1);
  assert.equal(result.totals[0].completedCount, 1);
  assert.equal(result.totals[0].completed, '0');
  assert.equal(maintenanceCosts([row(1e-7), row(2e-7)]).totals[0].completed, '0.0000003');
});
