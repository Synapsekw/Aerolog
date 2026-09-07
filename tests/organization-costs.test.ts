import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationCosts, organizationCostsCsv } from '../lib/reports/organization-costs';
const service = (id: string, data: object) => ({ id, kind: 'service', revision: 4, data });
test('organization cost report uses completion UTC date and includes every equipment kind once', () => {
  const records = [service('a', { completedAt: '2026-09-08T01:00:00+04:00', due: '2020-01-01', status: 'Completed', cost: 10, currency: 'AED', targetKind: 'asset', targetId: 'same' }), service('b', { due: '2026-09-07', status: 'In progress', cost: 20, currency: 'AED', targetKind: 'battery', targetId: 'same' }), service('invalid', { due: '2026-02-30', cost: 99 }), service('later', { due: '2026-09-08', cost: 99 })];
  const report = organizationCosts(records, '2026-09-07', '2026-09-07');
  assert.equal(report.rows.length, 2);
  assert.equal(report.undatedExcluded, 1);
  assert.equal(report.totals[0].completed, '10');
  assert.equal(report.totals[0].open, '20');
  assert.equal(report.rows[0][9], 4);
  assert.equal(report.rows[1][10], 'battery');
  assert.throws(()=>organizationCosts(records,'2026-02-30','2026-09-07'));
});
test('cost CSV includes all source rows and snapshot values, escaping spreadsheet formulas', () => {
  const records = Array.from({length: 30}, (_,i)=>service('s'+i,{due:'2026-09-07',task:'=SUM(1,2)',cost:1,currency:'AED',status:'Completed'}));
  const report = organizationCosts(records,'2026-09-07','2026-09-07');
  Object.assign(records[0].data, {cost:999});
  assert.equal(report.totals[0].completed,'30');
  const csv = organizationCostsCsv(report,'Org','2026-09-07T12:00:00Z');
  assert.ok(csv.includes('"s29"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"Source revision"'));
});
