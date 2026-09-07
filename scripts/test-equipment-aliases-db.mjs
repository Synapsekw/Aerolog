import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';
 for(const id of ['QA-ALIAS-A','QA-ALIAS-B','QA-ALIAS-C'])await db.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'asset',$2,$3)",[org,id,{id,name:id,category:'Aircraft',status:'Retired',hours:20,next:100,intervalHours:100}]);
 const add=(source,target)=>db.query("insert into aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by) values($1,'asset',$2,$3,$4)",[org,source,target,actor]);
 await add('QA-ALIAS-A','QA-ALIAS-B');await add('QA-ALIAS-B','QA-ALIAS-C');
 async function reject(fn,pattern){await db.query('savepoint probe');try{await fn();assert.fail('Invalid identity operation accepted')}catch(e){assert.match(e.message,pattern)}finally{await db.query('rollback to savepoint probe')}}
 await reject(()=>add('QA-ALIAS-C','QA-ALIAS-A'),/cycle/);
 await reject(()=>add('QA-ALIAS-C','missing'),/foreign key/);
 await reject(()=>db.query("update aerolog_equipment_aliases set canonical_id='QA-ALIAS-C' where organization_id=$1 and source_id='QA-ALIAS-A'",[org]),/immutable/);
 await reject(()=>db.query("delete from aerolog_records where organization_id=$1 and kind='asset' and id='QA-ALIAS-A'",[org]),/merged source record/);
 assert.equal((await db.query("select has_table_privilege('authenticated','aerolog_equipment_aliases','insert') allowed")).rows[0].allowed,false);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await db.query('set local role authenticated');
 assert.equal((await db.query('select count(*)::int n from aerolog_equipment_aliases where organization_id=$1',[org])).rows[0].n,2);
 await db.query('reset role');await db.query('rollback');console.log('Equipment aliases passed: retained source rows, chains, cycle/missing-target rejection, immutability and read-only authenticated access. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
