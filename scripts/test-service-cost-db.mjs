import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try{
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
 await c.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'asset','QA-COST-ASSET',$2)",[org,{id:'QA-COST-ASSET',name:'QA equipment',category:'Accessory',status:'Available',hours:0,next:100,intervalHours:100}]);
 const data={id:'QA-SERVICE-COST',asset:'QA equipment',task:'QA cost persistence',due:'2026-09-07',status:'Scheduled',technician:'QA technician',intervalHours:100,cost:null};
 const save=d=>c.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'service',$2,$3) on conflict(organization_id,kind,id) do update set data=excluded.data",[org,d.id,d]);
 async function reject(d,pattern){await c.query('savepoint probe');try{await save(d);assert.fail('Invalid cost accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe')}}
 await save(data);await save({...data,cost:0,currency:'AED'});
 await save({...data,cost:123.456,currency:'KWD',costReference:'QA-INV-1'});
 const row=(await c.query("select data from aerolog_records where organization_id=$1 and kind='service' and id=$2",[org,data.id])).rows[0].data;
 assert.equal(row.cost,123.456);assert.equal(row.currency,'KWD');assert.equal(row.costReference,'QA-INV-1');
 await reject({...data,cost:-1,currency:'AED'},/allowed range/);
 await reject({...data,cost:1},/currency code/);
 await reject({...data,cost:'1',currency:'AED'},/numeric/);
 await c.query('rollback');console.log('Service cost checks passed: unknown, zero, decimal persistence, reference and invalid input. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
