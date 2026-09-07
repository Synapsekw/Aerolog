import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');if(process.argv.includes('--preview-migration'))await db.query(fs.readFileSync('supabase/migrations/202609070048_inspection_meter_routes.sql','utf8'));
 const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';
 const insert=(kind,id,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,id,{id,...data}]);
 for(const [id,hours] of [['QA-ROUTE-A',140],['QA-ROUTE-B',120]])await insert('asset',id,{name:id,category:'Aircraft',hours,next:200,intervalHours:100,status:'Available'});
 await db.query("insert into aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by)values($1,'asset','QA-ROUTE-A','QA-ROUTE-B',$2)",[org,actor]);
 await insert('inspection_plan','QA-ROUTE-PLAN',{targetKind:'asset',targetId:'QA-ROUTE-A',baselineDate:'2026-09-01',baseline:{hours:100,flights:200,cycles:null},capturedFlightCount:0,profileSnapshot:{rules:[{id:'r',hours:30}]}});
 await insert('flight','QA-ROUTE-F1',{durationSeconds:60,altitude:10,distance:0,telemetry:[],aircraftId:'QA-ROUTE-A',equipmentIds:['QA-ROUTE-B']});
 await db.query("insert into aerolog_inspection_meter_routes(organization_id,plan_id,target_kind,target_id,hours_anchor,hours_base,flights_anchor,flights_base)values($1,'QA-ROUTE-PLAN','asset','QA-ROUTE-B',120,140,1,210)",[org]);
 const meters=async()=>(await db.query("select aerolog_inspection_current_meters($1,'QA-ROUTE-PLAN') meters",[org])).rows[0].meters;
 const blockers=async()=>(await db.query("select aerolog_inspection_blockers($1,'asset','QA-ROUTE-B','2026-09-07') count",[org])).rows[0].count;
 assert.deepEqual(await meters(),{hours:140,cycles:null,flights:210});assert.equal(await blockers(),1);
 await db.query("update aerolog_records set data=jsonb_set(data,'{hours}','125') where organization_id=$1 and kind='asset' and id='QA-ROUTE-B'",[org]);
 await insert('flight','QA-ROUTE-F2',{durationSeconds:60,altitude:10,distance:0,telemetry:[],aircraftId:'QA-ROUTE-B'});
 assert.deepEqual(await meters(),{hours:145,cycles:null,flights:211});
 await insert('inspection_event','QA-ROUTE-E',{planId:'QA-ROUTE-PLAN',ruleId:'r',date:'2026-09-07',meters:{hours:145,cycles:null,flights:211},signedAt:'2026-09-07T12:00:00Z'});
 assert.equal(await blockers(),0);
 await db.query("update aerolog_records set data=jsonb_set(data,'{hours}','119') where organization_id=$1 and kind='asset' and id='QA-ROUTE-B'",[org]);assert.equal((await meters()).hours,null);assert.equal(await blockers(),1);
 const original=(await db.query("select data from aerolog_records where organization_id=$1 and id='QA-ROUTE-PLAN'",[org])).rows[0].data;assert.equal(original.baseline.hours,100);assert.equal(original.targetId,'QA-ROUTE-A');
 assert.equal((await db.query("select has_table_privilege('authenticated','public.aerolog_inspection_meter_routes','INSERT') allowed")).rows[0].allowed,false);
 await db.query('rollback');console.log('Inspection meter routes passed: preserved original baseline, canonical readiness, future hours/flight increments, deduplication, signed reset, counter-drop blocker and protected writes. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
