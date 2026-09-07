import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try{
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",['30dd24a8-3fe1-48c4-b5ff-271cf663f223']);
 const insert=(kind,data)=>c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 const get=async(kind,id)=>(await c.query('select * from aerolog_records where organization_id=$1 and kind=$2 and id=$3',[org,kind,id])).rows[0];
 await insert('battery',{id:'QA-SERVICE-BAT',model:'QA pack',cycles:42,status:'Quarantined',health:70,temp:20});
 await insert('asset',{id:'QA-SERVICE-ASSET',name:'QA retired asset',category:'Aircraft',status:'Retired',hours:50,next:60,intervalHours:100});
 for(const [kind,id] of [['battery','QA-SERVICE-BAT'],['asset','QA-SERVICE-ASSET']]){
  const work={id:'QA-WORK-'+kind,asset:'Display name is not the identity',targetKind:kind,targetId:id,task:'QA service',due:'2026-09-07',status:'Scheduled',technician:'QA',intervalHours:100,cost:12.345,currency:'KWD'};
  await c.query("select aerolog_command('save',$1)",[{kind:'service',data:work,revision:0}]);
  const saved=await get('service',work.id);assert.equal(saved.data.targetId,id);
  await c.query("select aerolog_command('service_complete',$1)",[{kind:'service',data:saved.data,revision:saved.revision,note:'QA findings recorded for regression only'}]);
  const completed=await get('service',work.id);assert.equal(completed.data.status,'Completed');assert.equal(completed.data.cost,12.345);assert.ok(completed.data.signedBy);
 }
 const battery=(await get('battery','QA-SERVICE-BAT')).data;assert.equal(battery.status,'Quarantined');assert.equal(battery.cycles,42);
 const asset=(await get('asset','QA-SERVICE-ASSET')).data;assert.equal(asset.status,'Retired');assert.equal(asset.next,150);
 await c.query('savepoint bad');try{await insert('service',{id:'QA-BAD',intervalHours:100,remaining:0,targetKind:'battery',targetId:'NO-SUCH-BATTERY',asset:'Unknown'});assert.fail('Missing target accepted')}catch(e){assert.match(e.message,/not found in this organization/);await c.query('rollback to savepoint bad')}
 await c.query('rollback');console.log('Service target checks passed: exact battery/asset identity, missing-target rejection, signed completion, retained cost, battery counters/condition and retirement. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
