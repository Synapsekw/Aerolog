import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentMergeReview} from '../lib/operations/equipment-merge-review';
import {reconcileEquipmentCounter} from '../lib/operations/equipment-merge-reconciliation';
const review=(kind:'asset'|'battery',a:unknown,b:unknown)=>equipmentMergeReview([{kind,id:'a',revision:2,data:{hours:a,cycles:a}},{kind,id:'b',revision:5,data:{hours:b,cycles:b}}],{kind,id:'a'},{kind,id:'b'});
test('counter reconciliation retains exact source revision without summing totals',()=>{
 const r=review('asset',12.5,20),original=JSON.stringify(r);
 const result=reconcileEquipmentCounter(r,{source:'keep',reason:'Verified current maintenance meter'});
 assert.equal(result.value,12.5);assert.equal(result.lowerThanOther,true);assert.equal(result.sourceId,'a');assert.equal(result.sourceRevision,2);assert.equal(JSON.stringify(r),original);
 assert.equal(reconcileEquipmentCounter(r,{source:'duplicate',reason:'Latest recorded meter reading'}).value,20);
});
test('unknown aircraft hours remain unknown and invalid or missing battery counters fail',()=>{
 assert.equal(reconcileEquipmentCounter(review('asset',null,10),{source:'keep',reason:'No verified meter is available'}).value,null);
 for(const value of [null,undefined,NaN,Infinity,-1,1.5,'20',100001]) assert.throws(()=>reconcileEquipmentCounter(review('battery',value,20),{source:'keep',reason:'Verified source reading evidence'}));
 assert.equal(reconcileEquipmentCounter(review('battery',0,20),{source:'keep',reason:'New replacement pack verified'}).value,0);
 assert.throws(()=>reconcileEquipmentCounter(review('asset',12,20),{source:'keep',reason:'  '}),/Explain/);
});
