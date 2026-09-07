import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',hash=randomBytes(32).toString('hex');
 const insert=(kind,id,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,id,{id,...data}]);
 await insert('asset','QA-FEED-EQUIPMENT',{name:'QA inspection aircraft',category:'Aircraft',hours:10,next:100,intervalHours:100,status:'Available'});
 await insert('inspection_plan','QA-FEED-PLAN',{targetKind:'asset',targetId:'QA-FEED-EQUIPMENT',baselineDate:'2026-01-01',profileSnapshot:{rules:[{id:'D',name:'Calendar inspection',days:30},{id:'H',name:'Counter only',days:null,hours:10}]}});
 await insert('inspection_event','QA-FEED-EVENT',{planId:'QA-FEED-PLAN',ruleId:'D',date:'2026-02-01',signedAt:'2026-02-01T12:00:00Z',findings:'Private findings must not be exposed'});
 await db.query('select aerolog_calendar_share($1,$2,$3,$4)',[actor,org,'create',{id:randomUUID(),label:'QA inspection feed',hash,from:'2026-03-01',to:'2026-03-31',kinds:['inspection'],expiresAt:new Date(Date.now()+86400000).toISOString()}]);
 const result=(await db.query('select aerolog_calendar_feed($1) feed',[hash])).rows[0].feed;
 const entries=result.entries.filter(e=>e.id.startsWith('QA-FEED-PLAN:'));
 assert.equal(entries.length,1);assert.equal(entries[0].date,'2026-03-03');assert.equal(entries[0].name,'QA inspection aircraft · Calendar inspection');assert.equal(entries[0].kind,'inspection');assert.match(entries[0].status,/counters may make/);
 assert.equal(JSON.stringify(result).includes('Private findings'),false);
 assert.equal(result.entries.some(e=>e.kind!=='inspection'),false);
 await db.query('rollback');console.log('Inspection feed passed: signed baseline date, day interval, counter-only omission, minimal title/status and no findings disclosure. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
