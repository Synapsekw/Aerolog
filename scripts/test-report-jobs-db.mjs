import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',id=randomUUID(),input={type:'Organization',entityId:'',from:'2026-01-01',to:'2026-12-31'};
 const fixture={id:'QA-REPORT-FLIGHT',date:'2026-09-01',pilot:'QA report pilot',durationSeconds:61,distance:'0.5',telemetry:[],altitude:60};await c.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'flight',$2,$3)",[org,fixture.id,fixture]);
 const enqueue=(request=input)=>c.query('select aerolog_report_enqueue($1,$2,$3,$4)',[actor,org,id,request]);await enqueue();await enqueue();
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await reject(()=>enqueue({...input,type:'Pilot'}),/request ID already used/);
 await c.query("update aerolog_records set data=data||'{\"durationSeconds\":99}' where organization_id=$1 and kind='flight' and id=$2",[org,fixture.id]);
 const claim=async()=>(await c.query('select aerolog_report_claim($1,$2,$3) result',[actor,org,id])).rows[0].result;
 const first=await claim();assert.equal(first.snapshot.records.find(r=>r.id===fixture.id).data.durationSeconds,61);assert.equal(await claim(),null);
 await c.query("update aerolog_report_jobs set lease_until=now()-interval '1 minute' where id=$1",[id]);const second=await claim();assert.notEqual(first.lease_token,second.lease_token);assert.equal(second.attempts,2);
 const finish=(token,artifact,failure=null)=>c.query('select aerolog_report_finish($1,$2,$3,$4,$5,$6) result',[id,token,artifact,{flightCount:1},'test-hash',failure]);
 assert.equal((await finish(first.lease_token,null,'Stale worker')).rows[0].result,false);
 await reject(()=>finish(second.lease_token,{id,path:'another-org/report.csv'}),/Invalid report artifact/);
 await finish(second.lease_token,{id,path:org+'/reports/'+id+'/'+second.lease_token+'.csv',name:'QA report.csv',size:100,type:'text/csv'});
 assert.equal(await claim(),null);assert.equal((await c.query('select status from aerolog_report_jobs where id=$1',[id])).rows[0].status,'Completed');
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await c.query('set local role authenticated');
 assert.equal((await c.query('select count(*)::int n from aerolog_report_jobs where id=$1',[id])).rows[0].n,1);
 await c.query('reset role');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[randomUUID()]);await c.query('set local role authenticated');assert.equal((await c.query('select count(*)::int n from aerolog_report_jobs where id=$1',[id])).rows[0].n,0);await c.query('reset role');
 await c.query('rollback');console.log('Report jobs checks passed: idempotency, frozen sources, exclusive leases, recovery, stale-worker rejection, artifact validation and RLS. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
