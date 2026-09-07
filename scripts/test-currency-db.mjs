import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 const insert=(kind,data)=>c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 const person={id:'QA-CURRENCY-P',name:'QA currency pilot',aircraftPermission:'All aircraft',status:'Available',expires:'2099-12-31',currencyPolicy:{enabled:true,days:30,minimumFlights:2,minimumMinutes:30,includeExternal:false}};
 await insert('crew',person);await insert('crew',{id:'QA-CURRENCY-O',name:'QA currency observer',status:'Available',expires:'2099-12-31'});await insert('asset',{id:'QA-CURRENCY-A',name:'QA currency aircraft',category:'Aircraft',status:'Available',hours:1,next:100,intervalHours:100});
 const mission={id:'QA-CURRENCY-M',name:'QA currency mission',pilot:person.name,observer:'QA currency observer',aircraft:'QA currency aircraft',date:'2026-09-07',time:'10:00',durationMinutes:60,altitude:60,status:'Pending approval',equipment:[],risks:[]};
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await reject(()=>insert('mission',mission),/recency policy/);
 const file={id:'QA-CURRENCY-FILE',targetKind:'crew',targetId:person.id,name:'External log.pdf',path:org+'/personnel/QA-CURRENCY-FILE',size:10,type:'application/pdf'};await c.query('select aerolog_crew_attach($1,$2,$3)',[actor,org,file]);
 const entry={id:'QA-EXT',date:'2026-09-06',flights:2,minutes:30,source:'External pilot logbook',notes:'Evidence totals reviewed',evidenceId:file.id};
 const update=patch=>c.query("update aerolog_records set data=data||$3::jsonb where organization_id=$1 and kind='crew' and id=$2",[org,person.id,JSON.stringify(patch)]);
 await update({externalTime:[entry]});
 let saved=(await c.query("select data from aerolog_records where organization_id=$1 and kind='crew' and id=$2",[org,person.id])).rows[0].data;assert.ok(saved.externalTime[0].recordedBy);
 await reject(()=>insert('mission',mission),/recency policy/);
 await update({currencyPolicy:{...person.currencyPolicy,includeExternal:true}});await insert('mission',mission);
 await reject(()=>update({externalTime:[{...entry,minutes:300}]}),/immutable/);
 await reject(()=>update({externalTime:[]}),/cannot be removed/);
 const summary=(await c.query('select aerolog_currency_summary($1,$2,$3) result',[org,{...saved,currencyPolicy:{...person.currencyPolicy,includeExternal:true}},'2026-09-06'])).rows[0].result;assert.equal(summary.count,0);
 await c.query('rollback');console.log('Currency checks passed: policy gate, verified evidence, separate external totals, explicit inclusion, date boundary and immutable ledger. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
