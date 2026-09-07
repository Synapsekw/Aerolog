import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {loadEnv} from './env.mjs';import {createFlightReport,reportCsv} from '../lib/reports/flight-report.ts';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');if(process.argv.includes('--preview-migration'))await db.query(fs.readFileSync('supabase/migrations/202609070055_report_equipment_families.sql','utf8'));
 const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';const insert=(kind,id,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data)values($1,$2,$3,$4)',[org,kind,id,{id,...data}]);
 for(const id of ['QA-REPORT-SOURCE','QA-REPORT-KEEP','QA-REPORT-LATER'])await insert('asset',id,{name:id,category:'Aircraft',hours:10,next:100,intervalHours:100,status:'Available'});
 const flight=(id,aircraftId)=>insert('flight',id,{aircraftId,aircraft:aircraftId,pilot:'QA',date:'2026-09-07',durationSeconds:60,distance:1,altitude:10,telemetry:[]});
 await flight('QA-REPORT-ORIGINAL-FLIGHT','QA-REPORT-SOURCE');
 await insert('service','QA-REPORT-ORIGINAL-SERVICE',{targetKind:'asset',targetId:'QA-REPORT-SOURCE',asset:'QA-REPORT-SOURCE',task:'Original service',status:'Completed',completedAt:'2026-09-07T00:00:00Z',intervalHours:100,cost:12.5,currency:'AED'});
 const alias=(source,target)=>db.query("insert into aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by)values($1,'asset',$2,$3,$4)",[org,source,target,actor]);await alias('QA-REPORT-SOURCE','QA-REPORT-KEEP');
 const enqueue=async(entityId,type='Aircraft')=>{const id=randomUUID();await db.query('select aerolog_report_enqueue($1,$2,$3,$4)',[actor,org,id,{type,entityId,from:'2026-09-01',to:'2026-09-30',includeHistory:type==='Aircraft',format:'CSV'}]);return id};
 const load=async(id)=>(await db.query('select request,snapshot,created_at from aerolog_report_jobs where id=$1',[id])).rows[0];
 const calculate=job=>createFlightReport(job.request,job.snapshot.records,job.snapshot.members,job.snapshot.equipmentAliases);
 const id=await enqueue('QA-REPORT-KEEP'),job=await load(id),report=calculate(job),bytes=reportCsv(report,job.snapshot.organization,job.created_at.toISOString());
 assert.equal(report.version,2);assert.equal(report.flightCount,1);assert.equal(report.durationSeconds,60);assert.equal(report.history.rows[0][3],'QA-REPORT-ORIGINAL-SERVICE');assert.equal(job.snapshot.equipmentAliases.length,1);
 await alias('QA-REPORT-KEEP','QA-REPORT-LATER');await flight('QA-REPORT-LATER-FLIGHT','QA-REPORT-LATER');
 const frozen=await load(id);assert.equal(frozen.snapshot.equipmentAliases.length,1);assert.equal(reportCsv(calculate(frozen),frozen.snapshot.organization,frozen.created_at.toISOString()),bytes);
 const later=calculate(await load(await enqueue('QA-REPORT-LATER')));assert.equal(later.flightCount,2);assert.equal(later.durationSeconds,120);assert.equal(later.history.rows.length,1);
 const costs=await load(await enqueue('','Maintenance costs'));assert(costs.snapshot.records.every(r=>r.kind==='service'));assert.equal(costs.snapshot.equipmentAliases.length,0);
 await db.query('rollback');console.log('Equipment report snapshots passed: family flights/service, retained original identities, frozen bytes after a later merge/import, new family totals and preserved financial scope. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
