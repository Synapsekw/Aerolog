import test from 'node:test';import assert from 'node:assert/strict';
import {equipmentMergeReview} from '../lib/operations/equipment-merge-review';
import {reconcileEquipmentCounter} from '../lib/operations/equipment-merge-reconciliation';
import {mergeInspectionImpact} from '../lib/operations/equipment-merge-inspections';
import type {ReportRecord} from '../lib/reports/flight-report';
test('merge preview detects postponed inspection and retains signed baselines',()=>{
 const records:ReportRecord[]=[{kind:'asset',id:'a',revision:1,data:{name:'A',hours:140}},{kind:'asset',id:'b',revision:2,data:{name:'B',hours:120}},
 {kind:'inspection_plan',id:'p',revision:3,data:{targetKind:'asset',targetId:'a',baselineDate:'2026-01-01',baseline:{hours:100,flights:0,cycles:null},capturedFlightCount:0,profileSnapshot:{rules:[{id:'r',name:'Inspect',hours:30,flights:null,cycles:null,days:null}]}}}];
 const r=equipmentMergeReview(records,{kind:'asset',id:'a'},{kind:'asset',id:'b'}),decision=reconcileEquipmentCounter(r,{source:'duplicate',reason:'Verified latest meter on physical aircraft'}),original=JSON.stringify(records);
 const impact=mergeInspectionImpact(records,r,decision,'2026-09-07')[0];
 assert.equal(impact.beforeStatus,'Due');assert.equal(impact.afterStatus,'Within limits');assert.equal(impact.losesDueStatus,true);assert.equal(impact.changes[0].postponed,true);assert.equal(impact.changes[0].before,-10);assert.equal(impact.changes[0].after,10);assert.equal(JSON.stringify(records),original);
 records.push({kind:'inspection_event',id:'e',revision:1,data:{id:'e',planId:'p',ruleId:'r',date:'2026-09-06',meters:{hours:135,flights:0,cycles:null},signedAt:'2026-09-06T10:00:00Z'}});
 const signed=mergeInspectionImpact(records,r,decision,'2026-09-07')[0];assert.equal(signed.beforeStatus,'Within limits');assert.equal(signed.afterStatus,'Needs counters');assert.equal(signed.changes[0].after,null);
});
test('merge preview keeps calendar thresholds and unrelated inspection plans separate',()=>{
 const records:ReportRecord[]=[{kind:'battery',id:'a',revision:1,data:{cycles:20}},{kind:'battery',id:'b',revision:1,data:{cycles:10}},
 {kind:'inspection_plan',id:'p',revision:1,data:{targetKind:'battery',targetId:'a',baselineDate:'2026-09-01',baseline:{hours:null,cycles:0,flights:0},capturedFlightCount:0,profileSnapshot:{rules:[{id:'r',name:'Calendar',hours:null,cycles:null,flights:null,days:5}]}}},
 {kind:'inspection_plan',id:'other',revision:1,data:{targetKind:'asset',targetId:'a'}}];
 const r=equipmentMergeReview(records,{kind:'battery',id:'a'},{kind:'battery',id:'b'});const impact=mergeInspectionImpact(records,r,reconcileEquipmentCounter(r,{source:'duplicate',reason:'Verified replacement device meter'}),'2026-09-07');assert.equal(impact.length,1);assert.equal(impact[0].afterStatus,'Due');assert.equal(impact[0].requiresReconciliation,false);assert.equal(impact[0].changes[0].before,-1);assert.equal(impact[0].changes[0].after,-1);
});
