import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",['30dd24a8-3fe1-48c4-b5ff-271cf663f223']);
 const insert=(kind,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 await insert('asset',{id:'QA-BULK-A',name:'QA bulk aircraft',category:'Aircraft',status:'Retired',hours:50,next:100,intervalHours:100});
 await insert('battery',{id:'QA-BULK-B',model:'QA pack',status:'Quarantined',cycles:42,health:70,temp:20});
 const items=[{kind:'asset',id:'QA-BULK-A',revision:1},{kind:'battery',id:'QA-BULK-B',revision:1}];
 const run=(selected,patch)=>db.query('select aerolog_bulk_equipment_metadata($1,$2,$3)',[JSON.stringify(selected),patch,org]);
 const get=async id=>(await db.query('select data,revision from aerolog_records where organization_id=$1 and id=$2',[org,id])).rows[0];
 await run(items,{manufacturer:'QA manufacturer'});
 const a=await get('QA-BULK-A'),b=await get('QA-BULK-B');assert.equal(a.revision,2);assert.equal(b.revision,2);assert.equal(a.data.status,'Retired');assert.equal(a.data.hours,50);assert.equal(b.data.cycles,42);assert.equal(b.data.status,'Quarantined');
 async function reject(selected,patch,pattern){await db.query('savepoint probe');try{await run(selected,patch);assert.fail('Invalid batch accepted')}catch(e){assert.match(e.message,pattern)}finally{await db.query('rollback to savepoint probe')}}
 await reject([{...items[0],revision:2},items[1]],{firmware:'Must not persist'},/changed/);
 assert.equal((await get('QA-BULK-A')).data.firmware,undefined);
 const current=items.map(i=>({...i,revision:2}));
 await reject(current,{storageSiteId:'not-in-organization'},/Storage site not found/);
 await reject(current,{cycles:0},/Unsupported bulk metadata/);
 await reject([current[0],current[0]],{firmware:'x'},/Duplicate/);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",['a03e4339-a2e8-4726-ab1a-54c44670c023']);
 await reject(current,{firmware:'x'},/Fleet management/);
 await db.query('rollback');console.log('Bulk equipment checks passed: mixed-kind updates, revision atomicity, preserved counters/status, invalid site/field/duplicate and pilot rejection. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
