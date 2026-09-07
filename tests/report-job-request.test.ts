import test from 'node:test';
import assert from 'node:assert/strict';
import { reportJobRequestSchema } from '../lib/reports/job-request';
test('saved cost jobs require valid dates and supported formats without changing flight requests', () => {
  const cost = {type:'Maintenance costs',from:'2026-09-01',to:'2026-09-07'};
  assert.equal(reportJobRequestSchema.parse(cost).format,'CSV');
  assert.equal(reportJobRequestSchema.safeParse({...cost,format:'PDF'}).success,true);
  assert.equal(reportJobRequestSchema.safeParse({...cost,format:'XLSX'}).success,false);
  assert.equal(reportJobRequestSchema.safeParse({...cost,to:'2026-01-01'}).success,false);
  assert.equal(reportJobRequestSchema.safeParse({type:'Pilot',entityId:'ivan',from:cost.from,to:cost.to,format:'PDF'}).success,true);
});
