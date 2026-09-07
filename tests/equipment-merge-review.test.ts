import test from 'node:test';import assert from 'node:assert/strict';import {equipmentMergeReview} from '../lib/operations/equipment-merge-review';
const r=(kind:string,id:string,data:Record<string,any>)=>({kind,id,data,revision:2});
test('merge review preserves typed identities and detects immutable/history dependencies',()=>{
 const records=[r('asset','a',{name:'Aircraft',serial:'ONE',category:'Aircraft',hours:10}),r('asset','b',{name:'Duplicate',serial:'TWO',category:'Aircraft',hours:20}),r('battery','a',{model:'Pack'}),r('flight','f',{aircraftId:'a',aircraft:'Wrong name'}),r('flight','not-a',{aircraftId:'b',aircraft:'Aircraft'}),r('mission','m',{status:'Approved',kitSnapshots:[{items:[{kind:'asset',id:'a'}]}]}),r('service','s',{targetKind:'battery',targetId:'a'}),r('document','d',{targetKind:'asset',targetId:'a'}),r('inspection_plan','p',{targetKind:'asset',targetId:'a'}),r('inspection_event','event',{planId:'p'}),r('incident','i',{equipment:[{kind:'asset',id:'a'}]}),r('crew','c',{authorizedAircraftIds:['a']})];
 const before=JSON.stringify(records),review=equipmentMergeReview(records,{kind:'asset',id:'a'},{kind:'asset',id:'b'});
 assert.ok(review.conflicts.includes('Different recorded serial numbers'));
 assert.deepEqual(review.keepReferences.map(r=>r.id).sort(),['c','d','event','f','i','m','p']);
 assert.deepEqual(review.duplicateReferences.map(r=>r.id),['not-a']);
 assert.equal(review.differences.find(r=>r.field==='hours')?.keep,10);assert.equal(JSON.stringify(records),before);
});
test('merge review refuses identical, mixed-kind or absent records',()=>{
 const records=[r('asset','a',{}),r('battery','b',{})];
 assert.throws(()=>equipmentMergeReview(records,{kind:'asset',id:'a'},{kind:'battery',id:'b'}));
 assert.throws(()=>equipmentMergeReview(records,{kind:'asset',id:'a'},{kind:'asset',id:'a'}));
 assert.throws(()=>equipmentMergeReview(records,{kind:'asset',id:'a'},{kind:'asset',id:'missing'}));
});
