import fs from 'node:fs';import assert from 'node:assert/strict';import pg from 'pg';import{loadEnv}from'./env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try{await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
const a=(await c.query("select id,data from aerolog_records where organization_id=$1 and kind='asset' and data->>'category'='Aircraft' limit 1",[org])).rows[0];
const kit={id:'QA-SNAPSHOT-KIT',name:'Snapshot original',items:[{kind:'asset',id:a.id}],notes:'',archived:false};await c.query('select aerolog_save_kit($1,0,$2)',[kit,org]);
const base=(await c.query("select data from aerolog_records where organization_id=$1 and kind='mission' limit 1",[org])).rows[0].data;
const mission={...base,id:'QA-SNAPSHOT-MISSION',status:'Draft',aircraft:a.data.name,equipment:[],kitSelections:[{id:kit.id,revision:1}],kitSnapshots:[{name:'Forged'}]};
await c.query("insert into aerolog_records(organization_id,kind,id,data,created_by) values($1,'mission',$2,$3,$4)",[org,mission.id,mission,actor]);
const read=async()=>(await c.query("select data from aerolog_records where organization_id=$1 and kind='mission' and id=$2",[org,mission.id])).rows[0].data;
let saved=await read();assert.equal(saved.kitSnapshots[0].name,'Snapshot original');assert.equal(saved.kitSnapshots[0].items[0].id,a.id);
await c.query('select aerolog_save_kit($1,1,$2)',[{...kit,name:'Changed kit'},org]);
await c.query("update aerolog_records set data=jsonb_set(data,'{notes}','\"Changed mission notes\"') where organization_id=$1 and kind='mission' and id=$2",[org,mission.id]);
assert.deepEqual((await read()).kitSnapshots,saved.kitSnapshots);
await c.query('savepoint removed');try{await c.query("update aerolog_records set data=jsonb_set(data,'{aircraft}','\"Removed aircraft\"') where organization_id=$1 and kind='mission' and id=$2",[org,mission.id]);assert.fail('Removed kit equipment accepted')}catch(err){assert.match(err.message,/Kit equipment removed/);await c.query('rollback to savepoint removed');}
await c.query('rollback');console.log('Kit snapshot checks passed: authoritative contents, immutable versions, removed-item rejection. All fixtures rolled back.');
}catch(err){await c.query('rollback');console.error(err.message);process.exitCode=1}finally{await c.end()}
