import test from 'node:test';import assert from 'node:assert/strict';
import {inspectionCalendar} from '../lib/operations/inspection-calendar';
test('inspection calendar uses latest signed baseline while meter-only rules remain undated',()=>{
 const plan:any={id:'p',targetKind:'battery',targetId:'same-id',baselineDate:'2026-01-01',baseline:{hours:0,flights:0,cycles:0},capturedFlightCount:0,profileSnapshot:{rules:[{id:'dated',name:'Storage check',days:30,cycles:10},{id:'meter',name:'Cycle check',cycles:10}]}};
 const events:any=[{id:'event',planId:'p',ruleId:'dated',date:'2026-02-01',meters:{cycles:1,hours:0,flights:0}}];
 const result=inspectionCalendar([plan],events,[{kind:'asset',id:'same-id',name:'Wrong equipment',cycles:0},{kind:'battery',id:'same-id',model:'Pack',cycles:20}],[],'2026-02-10');
 assert.equal(result.entries.length,1);assert.equal(result.withoutCalendarDate,1);
 assert.equal(result.entries[0].date,'2026-03-03');assert.equal(result.entries[0].status,'Due');
 assert.equal(result.entries[0].name,'Pack · Storage check');assert.equal(result.entries[0].targetKind,'battery');
});
