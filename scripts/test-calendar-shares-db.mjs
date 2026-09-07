import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;
const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',id=randomUUID(),hash=randomBytes(32).toString('hex');
 const doc={id,label:'QA calendar',hash,from:'2000-01-01',to:'2099-12-31',kinds:['flight'],expiresAt:new Date(Date.now()+86400000).toISOString()};
 const action=(who,organization,operation,data)=>db.query('select aerolog_calendar_share($1,$2,$3,$4)',[who,organization,operation,data]);
 const feed=async()=>(await db.query('select aerolog_calendar_feed($1) value',[hash])).rows[0].value;
 await action(actor,org,'create',doc);
 const result=await feed();assert.ok(result.entries.length>0);assert.ok(result.entries.every(e=>e.kind==='flight'));assert.ok(result.entries.every(e=>Object.keys(e).every(k=>['id','kind','name','date','time','durationMinutes','status'].includes(k))));
 async function reject(fn,pattern){await db.query('savepoint probe');try{await fn();assert.fail('Forbidden action accepted')}catch(e){assert.match(e.message,pattern)}finally{await db.query('rollback to savepoint probe')}}
 await reject(()=>action('a03e4339-a2e8-4726-ab1a-54c44670c023',org,'create',{...doc,id:randomUUID()}),/manager required/);
 await reject(()=>action(actor,'eee5a600-781d-45e0-a37c-8182719b99d8','revoke',{id}),/manager required/);
 await db.query('savepoint expiry');await db.query("update aerolog_calendar_shares set expires_at=now()-interval '1 minute' where id=$1",[id]);assert.equal(await feed(),null);await db.query('rollback to savepoint expiry');
 await db.query('savepoint membership');await db.query("update aerolog_memberships set active=false where organization_id=$1 and user_id=$2",[org,actor]);assert.equal(await feed(),null);await db.query('rollback to savepoint membership');
 await action(actor,org,'revoke',{id});assert.equal(await feed(),null);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.aerolog_calendar_feed(text)','execute') allowed")).rows[0].allowed,false);
 await db.query('rollback');console.log('Calendar share checks passed: minimal projection, category scope, role/org guards, expiry, membership revocation, explicit revocation and private RPC. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
