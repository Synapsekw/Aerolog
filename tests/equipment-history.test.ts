import test from 'node:test';import assert from 'node:assert/strict';
import {createFlightReport,reportCsv,type ReportRecord} from '../lib/reports/flight-report';
const record=(kind:string,id:string,data:object):ReportRecord=>({kind,id,revision:2,data});
test('equipment history uses exact targets and event dates with separate currencies/counters',()=>{
 const records=[record('battery','b',{model:'Pack'}),record('service','s',{targetKind:'battery',targetId:'b',status:'Completed',due:'2020-01-01',completedAt:'2026-09-07T01:00:00Z',task:'Repair',cost:1.234,currency:'KWD'}),record('service','wrong',{targetKind:'asset',targetId:'b',due:'2026-09-07'}),record('battery_reading','r',{batteryId:'b',measuredAt:'2026-09-07T03:00:00+04:00',deviceCycles:42}),record('battery_event','e',{battery:'b',date:'2026-09-07',cycles:43})];
 const report=createFlightReport({type:'Battery',entityId:'b',from:'2026-09-07',to:'2026-09-07',includeHistory:true},records,[]);
 assert.equal(report.history?.rows.length,2);assert.equal(report.history?.rows.find(r=>r[3]==='s')?.[7],1.234);
 assert.equal(report.history?.rows.some(r=>r[3]==='r'),false); // UTC measurement date is September 6.
 assert.match(reportCsv(report,'Org','now'),/Equipment history/);
 assert.equal(createFlightReport({type:'Battery',entityId:'b',from:'2026-09-07',to:'2026-09-07'},records,[]).history,undefined);
});
