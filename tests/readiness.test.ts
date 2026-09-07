import test from 'node:test';
import assert from 'node:assert/strict';
import { personnelDocumentAttention } from '../lib/operations/readiness';
test('attention excludes inactive linked personnel and archived documents, preserves date boundaries',()=>{
 const crew=[{id:'p',name:'Pilot',authUserId:'user',status:'Available',cert:'Certificate',expires:'2026-09-07',aircraftPermission:'All aircraft',qualifications:[{id:'q',name:'Rating',expires:'2026-09-08',evidenceId:''}]}];
 const docs=[{id:'d',name:'Permit',expires:'2026-09-06',status:'Approved'},{id:'archived',name:'Old',expires:'2000-01-01',archived:true}];
 const active=personnelDocumentAttention(crew,[{id:'user',active:true}],docs,'2026-09-07');
 assert.equal(active.length,3);
 assert.equal(active.find(e=>e.key==='crew:p:certificate')?.priority,2);
 assert.match(active.find(e=>e.key==='crew:p:q')!.reason,/Evidence missing/);
 assert.equal(active.find(e=>e.id==='d')?.priority,0);
 assert.equal(personnelDocumentAttention(crew,[{id:'user',active:false}],docs,'2026-09-07').length,1);
});
