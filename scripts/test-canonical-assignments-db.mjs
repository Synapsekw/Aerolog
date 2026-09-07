import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');if(process.argv.includes('--preview-migration'))await db.query(fs.readFileSync('supabase/migrations/202609070052_canonical_assignment_guard.sql','utf8'));
 const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 for(const id of ['QA-ASSIGN-OLD','QA-ASSIGN-NEW'])await db.query("insert into aerolog_records(organization_id,kind,id,data)values($1,'asset',$2,$3)",[org,id,{id,name:id,category:'Aircraft',hours:10,next:100,intervalHours:100,status:'Available'}]);
 await db.query("insert into aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by)values($1,'asset','QA-ASSIGN-OLD','QA-ASSIGN-NEW',$2)",[org,actor]);
 const kit=(id,archived=false)=>db.query('select aerolog_save_kit($1,0,$2)',[{id:'QA-ASSIGN-KIT-'+id+archived,name:'QA kit '+id+archived,items:[{kind:'asset',id}],archived},org]);
 async function reject(fn){await db.query('savepoint stale');try{await fn();assert.fail('Merged source assignment accepted')}catch(e){assert.match(e.message,/merged source.*QA-ASSIGN-OLD.*canonical.*QA-ASSIGN-NEW/)}finally{await db.query('rollback to savepoint stale')}}
 await reject(()=>kit('QA-ASSIGN-OLD'));await kit('QA-ASSIGN-NEW');await kit('QA-ASSIGN-OLD',true);
 await db.query('create temporary table qa_assignment_probe(organization_id uuid,kind text,id text,data jsonb) on commit drop');await db.query('create trigger guard before insert on qa_assignment_probe for each row execute function public.aerolog_canonical_assignment_guard()');
 const mission=data=>db.query("insert into qa_assignment_probe values($1,'mission','QA-MISSION',$2)",[org,data]);
 await mission({status:'Draft',aircraft:'QA-ASSIGN-OLD',equipment:[]});
 await reject(()=>mission({status:'Pending approval',aircraft:'QA-ASSIGN-OLD',equipment:[]}));
 await reject(()=>mission({status:'Approved',aircraft:'QA-ASSIGN-NEW',equipment:[],kitSnapshots:[{items:[{kind:'asset',id:'QA-ASSIGN-OLD'}]}]}));
 await mission({status:'Pending approval',aircraft:'QA-ASSIGN-NEW',equipment:[]});
 await reject(()=>db.query("insert into qa_assignment_probe values($1,'inspection_plan','QA-PLAN',$2)",[org,{targetKind:'asset',targetId:'QA-ASSIGN-OLD'}]));
 await reject(()=>db.query("insert into qa_assignment_probe values($1,'service','QA-SERVICE',$2)",[org,{targetKind:'asset',targetId:'QA-ASSIGN-OLD'}]));
 await mission({status:'Completed',aircraft:'QA-ASSIGN-OLD',equipment:[]});
 await db.query('rollback');console.log('Canonical assignments passed: stale kits rejected, canonical kits accepted, archival retained, draft/completed history preserved, stale aircraft/snapshots blocked at approval. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
