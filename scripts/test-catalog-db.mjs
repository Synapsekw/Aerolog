import fs from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import { loadEnv } from './env.mjs';
const env = loadEnv(), url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
url.password = env.SUPABASE_DB_PASSWORD;
const db = new pg.Client({connectionString: url.toString(), ssl: {rejectUnauthorized: false}});
await db.connect();
try {
  await db.query('begin');
  const org = '2d1005c8-bea7-4a46-b863-c1afe8f31446', actor = '30dd24a8-3fe1-48c4-b5ff-271cf663f223';
  const write = (kind, data, revision=0, user=actor) => db.query('select aerolog_catalog_write($1,$2,$3,$4,$5)',[user,org,kind,data,revision]);
  async function reject(fn, pattern) {
    await db.query('savepoint probe');
    try { await fn(); assert.fail('Invalid operation accepted'); }
    catch(e) { assert.match(e.message, pattern); await db.query('rollback to savepoint probe'); }
  }
  const customer = {id:'QA-CAT-C',name:'Customer original',archived:false};
  const project = {id:'QA-CAT-P',name:'Project original',customerId:customer.id,archived:false};
  const site = {id:'QA-CAT-S',name:'Site original',purpose:'Operating area',projectId:project.id,geometry:[[55,25]],archived:false};
  await write('customer',customer); await write('project',project); await write('site',site);
  await reject(()=>write('project',{...project,name:'Stale'}), /Record changed/);
  await reject(()=>write('project',{...project,id:'QA-CAT-BAD',customerId:'another-org-customer'}), /Related record not found/);
  await reject(()=>write('customer',{...customer,id:'QA-CAT-PILOT'},0,'a03e4339-a2e8-4726-ab1a-54c44670c023'), /manager required/);
  const insert = (kind,data) => db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
  for (const id of ['QA-CAT-PILOT','QA-CAT-OBSERVER']) await insert('crew',{id,name:id,aircraftPermission:'All aircraft',status:'Available',expires:'2099-12-31'});
  await insert('asset',{id:'QA-CAT-A',name:'QA-CAT-A',category:'Aircraft',status:'Available',hours:1,next:100,intervalHours:100});
  const mission = {id:'QA-CAT-M',name:'Catalog snapshot test',status:'Draft',date:'2099-02-03',time:'10:00',durationMinutes:60,altitude:60,pilot:'QA-CAT-PILOT',observer:'QA-CAT-OBSERVER',aircraft:'QA-CAT-A',equipment:[],risks:[],projectId:project.id,siteId:site.id,contextSnapshot:{project:{name:'Forged'}}};
  await insert('mission',mission);
  const read = async() => (await db.query("select data from aerolog_records where organization_id=$1 and kind='mission' and id=$2",[org,mission.id])).rows[0].data;
  assert.equal((await read()).contextSnapshot.project.name,project.name);
  assert.equal((await read()).contextSnapshot.customer.name,customer.name);
  await reject(()=>insert('mission',{...mission,id:'QA-CAT-M-BAD',projectId:''}), /different project/);
  await write('site',{...site,purpose:'Storage'},1);
  await reject(()=>insert('mission',{...mission,id:'QA-CAT-M-STORAGE'}), /active operating site/);
  await write('site',site,2);
  await db.query("update aerolog_records set data=jsonb_set(data,'{status}','\"Pending approval\"') where organization_id=$1 and kind='mission' and id=$2",[org,mission.id]);
  const submitted = (await read()).contextSnapshot;
  await write('project',{...project,name:'Later project'},1);
  await write('site',{...site,name:'Later site',archived:true},3);
  await db.query("update aerolog_records set data=data || $3::jsonb where organization_id=$1 and kind='mission' and id=$2",[org,mission.id,JSON.stringify({status:'Approved',contextSnapshot:{site:{name:'Forged'}},projectId:'',siteId:''})]);
  const approved = await read(); assert.deepEqual(approved.contextSnapshot, submitted);assert.equal(approved.projectId,project.id);assert.equal(approved.siteId,site.id);
  await db.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'mission',$2,$3) on conflict(organization_id,kind,id) do update set data=excluded.data",[org,mission.id,{...approved,contextSnapshot:{}}]);
  assert.deepEqual((await read()).contextSnapshot,submitted);
  const permission = await db.query("select has_function_privilege('authenticated','public.aerolog_catalog_write(uuid,uuid,text,jsonb,integer)','execute') allowed");assert.equal(permission.rows[0].allowed,false);
  await db.query('rollback');
  console.log('Catalog checks passed: relationships, stale revision, pilot denial, storage/site mismatch, authoritative submitted snapshots and private RPC. All fixtures rolled back.');
} catch(e) {await db.query('rollback');console.error(e.message);process.exitCode=1;} finally {await db.end();}
