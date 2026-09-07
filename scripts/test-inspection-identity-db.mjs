import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');if(process.argv.includes('--preview-migration'))await db.query(fs.readFileSync('supabase/migrations/202609070046_inspection_identity_count.sql','utf8'));
 const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
 const insert=(kind,id,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,id,{id,...data}]);
 await insert('asset','QA-IDENTITY-A',{name:'QA identity aircraft',category:'Aircraft',hours:100,next:200,intervalHours:100,status:'Available'});
 for(const [id,data] of Object.entries({exact:{aircraftId:'QA-IDENTITY-A'},equipment:{equipmentIds:['QA-IDENTITY-A']},legacy:{aircraft:'QA identity aircraft'},wrong:{aircraftId:'other',aircraft:'QA identity aircraft'},extra:{equipmentIds:['other'],aircraft:'QA identity aircraft'}}))await insert('flight','QA-IDENTITY-'+id,{durationSeconds:60,altitude:10,distance:0,telemetry:[],...data});
 const count=async(kind='asset')=>(await db.query('select aerolog_equipment_flight_count($1,$2,$3) count',[org,kind,'QA-IDENTITY-A'])).rows[0].count;
 assert.equal(await count(),3);assert.equal(await count('battery'),0);
 await db.query('savepoint duplicate_name');try{await insert('asset','QA-IDENTITY-B',{name:'QA identity aircraft',category:'Aircraft',hours:0,next:200,intervalHours:100,status:'Available'});assert.fail('Duplicate asset name accepted')}catch(e){assert.equal(e.code,'23505')}finally{await db.query('rollback to savepoint duplicate_name')}
 assert.equal(await count(),3);
 await insert('inspection_plan','QA-IDENTITY-PLAN',{targetKind:'asset',targetId:'QA-IDENTITY-A',baselineDate:'2026-09-01',baseline:{hours:100,flights:200,cycles:null},capturedFlightCount:4,profileSnapshot:{rules:[{id:'flights',flights:20}]}});
 assert.equal((await db.query("select aerolog_inspection_blockers($1,'asset','QA-IDENTITY-A','2026-09-07') count",[org])).rows[0].count,1);
 await db.query('rollback');console.log('Inspection identity DB checks passed: exact IDs, unique legacy names, kind isolation and missing-counter blocker after count correction. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
