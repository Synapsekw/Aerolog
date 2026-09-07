import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const owner='2d1005c8-bea7-4a46-b863-c1afe8f31446',recipient=randomUUID(),admin='30dd24a8-3fe1-48c4-b5ff-271cf663f223',receiver='a03e4339-a2e8-4726-ab1a-54c44670c023',id=randomUUID();
 await db.query('insert into aerolog_organizations(id,name) values($1,$2)',[recipient,'QA recipient organization']);
 await db.query("update aerolog_profiles set organization_id=$1,role='manager' where id=$2",[recipient,receiver]);
 await db.query("insert into aerolog_memberships(organization_id,user_id,display_name,role,active) values($1,$2,'QA recipient','manager',true) on conflict(organization_id,user_id) do update set role='manager',active=true",[recipient,receiver]);
 await db.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'asset','QA-SHARED-EQUIPMENT',$2)",[owner,{id:'QA-SHARED-EQUIPMENT',name:'Shared aircraft',category:'Aircraft',status:'Retired',hours:20,next:100,intervalHours:100,notes:'PRIVATE owner evidence',serial:'QA-SHARED-SERIAL'}]);
 const action=(actor,org,op,doc)=>db.query('select aerolog_equipment_share($1,$2,$3,$4)',[actor,org,op,doc]);
 const list=async(actor,org)=>(await db.query('select aerolog_equipment_share_list($1,$2,0) list',[actor,org])).rows[0].list;
 await action(admin,owner,'create',{id,kind:'asset',equipmentId:'QA-SHARED-EQUIPMENT',recipientOrg:recipient,expiresAt:new Date(Date.now()+86400000).toISOString()});
 assert.equal((await list(receiver,recipient)).find(s=>s.id===id).equipment,null);
 await action(receiver,recipient,'accept',{id});let shared=(await list(receiver,recipient)).find(s=>s.id===id);
 assert.equal(shared.equipment.name,'Shared aircraft');assert.equal(shared.equipment.status,'Retired');assert.equal(shared.equipment.hours,20);assert.equal(JSON.stringify(shared).includes('PRIVATE owner evidence'),false);
 await db.query("update aerolog_records set data=jsonb_set(data,'{firmware}','\"Updated firmware\"'),revision=revision+1 where organization_id=$1 and id='QA-SHARED-EQUIPMENT'",[owner]);
 assert.equal((await list(receiver,recipient)).find(s=>s.id===id).equipment.firmware,'Updated firmware');
 await db.query('savepoint expiry');await db.query("update aerolog_equipment_shares set expires_at=now()-interval '1 minute' where id=$1",[id]);assert.equal((await list(receiver,recipient)).find(s=>s.id===id).equipment,null);await db.query('rollback to savepoint expiry');
 await action(admin,owner,'revoke',{id});shared=(await list(receiver,recipient)).find(s=>s.id===id);assert.equal(shared.status,'Revoked');assert.equal(shared.equipment,null);
 await db.query('savepoint wrong');try{await list(admin,recipient);assert.fail('Wrong organization accepted')}catch(e){assert.match(e.message,/manager required/)}finally{await db.query('rollback to savepoint wrong')}
 assert.equal((await db.query("select has_function_privilege('authenticated','public.aerolog_equipment_share_list(uuid,uuid,integer)','execute') allowed")).rows[0].allowed,false);
 await db.query('rollback');console.log('Equipment sharing passed: recipient acceptance, minimal live projection, retained owner status, expiry/revocation, org guard and private RPC. All fixtures and temporary profile context rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
