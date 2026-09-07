import test from 'node:test';import assert from 'node:assert/strict';
import {captureInspectionMeterRoute,routedInspectionMeters} from '../lib/operations/inspection-meter-routing';
import {inspectionDue,inspectionMeters,type InspectionPlan} from '../lib/operations/inspections';
test('inspection routing preserves accrued usage across lower register and future increments',()=>{
 const route=captureInspectionMeterRoute('p','asset','canonical',{hours:140,cycles:null,flights:210},{hours:120,cycles:null,flights:30});
 assert.deepEqual(routedInspectionMeters(route,{hours:125,cycles:null,flights:32}),{hours:145,cycles:null,flights:212});
 const plan={id:'p',targetKind:'asset',targetId:'source',baselineDate:'2026-09-01',baseline:{hours:100,cycles:null,flights:200},capturedFlightCount:0,profileSnapshot:{rules:[{id:'r',name:'Inspect',hours:30,cycles:null,flights:null,days:null}]}} as InspectionPlan;
 assert.equal(inspectionDue(plan,[],routedInspectionMeters(route,{hours:120,cycles:null,flights:30}),'2026-09-07')[0].status,'Due');
 assert.equal(routedInspectionMeters(route,{hours:119,cycles:null,flights:29}).hours,null);
 assert.equal(routedInspectionMeters(route,{hours:119,cycles:null,flights:29}).flights,null);
});
test('inspection route counts each flight once across identities while preserving signed coordinate system',()=>{
 const plan={id:'p'} as InspectionPlan;
 const route=captureInspectionMeterRoute('p','battery','b',{hours:null,cycles:100,flights:10},{hours:null,cycles:80,flights:1});
 const meters=inspectionMeters(plan,[{kind:'battery',id:'a',cycles:100},{kind:'battery',id:'b',cycles:82}],[{battery:'a',batteryIds:['b']},{battery:'b'}],[route],[{kind:'battery',source_id:'a',canonical_id:'b'}]);
 assert.deepEqual(meters,{hours:null,cycles:102,flights:11});
 assert.throws(()=>captureInspectionMeterRoute('p','battery','b',{hours:null,cycles:-1,flights:10},{hours:null,cycles:80,flights:1}));
 assert.equal(routedInspectionMeters({...route,cycles_base:null},{hours:null,cycles:82,flights:2}).cycles,null);
});
