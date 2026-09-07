import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',recipient=randomUUID(),job=randomUUID(),share=randomUUID();
 for(const id of ['QA-MERGE-A','QA-MERGE-B'])await db.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'asset',$2,$3)",[org,id,{id,name:id,category:'Aircraft',status:'Retired',hours:20,next:100,intervalHours:100,notes:'Not needed in merge projection',sourceRecord:{private:'Raw import'},geometry:[[1,2]]}]);
 await db.query('select aerolog_report_enqueue($1,$2,$3,$4)',[actor,org,job,{type:'Aircraft',entityId:'QA-MERGE-A',from:'2026-01-01',to:'2026-12-31'}]);
 await db.query('insert into aerolog_organizations(id,name) values($1,$2)',[recipient,'QA merge recipient']);
 await db.query('select aerolog_equipment_share($1,$2,$3,$4)',[actor,org,'create',{id:share,kind:'asset',equipmentId:'QA-MERGE-B',recipientOrg:recipient,expiresAt:new Date(Date.now()+86400000).toISOString()}]);
 const context=async(who=actor,organization=org)=>(await db.query('select aerolog_equipment_merge_context($1,$2,$3,$4,$5) context',[who,organization,'asset','QA-MERGE-A','QA-MERGE-B'])).rows[0].context;
 const before=await context();assert.ok(before.reportReferences.some(r=>r.id===job));assert.ok(before.shareReferences.some(r=>r.id===share));
 const equipment=before.records.find(r=>r.id==='QA-MERGE-A');assert.equal(equipment.revision,1);assert.equal(equipment.data.sourceRecord,undefined);assert.equal(equipment.data.notes,undefined);
 await db.query("update aerolog_records set data=jsonb_set(data,'{hours}','21'),revision=revision+1 where organization_id=$1 and id='QA-MERGE-A'",[org]);assert.equal((await context()).records.find(r=>r.id==='QA-MERGE-A').revision,2);
 for(const [who,organization] of [['a03e4339-a2e8-4726-ab1a-54c44670c023',org],[actor,recipient]]){await db.query('savepoint denied');try{await context(who,organization);assert.fail('Unauthorized review accepted')}catch(e){assert.match(e.message,/manager required/)}finally{await db.query('rollback to savepoint denied')}}
 assert.equal((await db.query("select has_function_privilege('authenticated','public.aerolog_equipment_merge_context(uuid,uuid,text,text,text)','execute') allowed")).rows[0].allowed,false);
 await db.query('rollback');console.log('Merge context passed: current revisions, frozen report/share references, reduced projection and role/org guards. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
