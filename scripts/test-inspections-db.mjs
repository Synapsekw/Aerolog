import fs from'node:fs';import assert from'node:assert/strict';import pg from'pg';import{loadEnv}from'./env.mjs';const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try{await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';
const today=(await c.query("select to_char(now() at time zone (select settings->>'timezone' from aerolog_organizations where id=$1),'YYYY-MM-DD') d",[org])).rows[0].d;
await c.query("insert into aerolog_records(organization_id,kind,id,data)values($1,'asset','QA-INSP-ASSET',$2)",[org,{id:'QA-INSP-ASSET',name:'QA inspection asset',category:'Aircraft',serial:'QA-INSP',hours:10,next:100,intervalHours:100,status:'Available'}]);
const write=async(kind,doc,revision=0)=>(await c.query('select aerolog_inspection_write($1,$2,$3,$4,$5) result',[actor,org,kind,doc,revision])).rows[0].result;
const p={id:'QA-IP',name:'QA Profile',model:'QA',archived:false,rules:[{id:'R',name:'Inspect',action:'Inspect',component:'Motor',hours:5,flights:null,cycles:null,days:30}]};await write('inspection_profile',p);
const plan=await write('inspection_plan',{id:'QA-PLAN',profileId:p.id,targetKind:'asset',targetId:'QA-INSP-ASSET',baselineDate:today,baseline:{hours:10,flights:null,cycles:null}});
await write('inspection_profile',{...p,name:'Changed profile'},1);assert.equal(plan.data.profileSnapshot.name,'QA Profile');
const due=async()=>(await c.query('select aerolog_inspection_blockers($1,$2,$3,$4) n',[org,'asset','QA-INSP-ASSET',today])).rows[0].n;
assert.equal(await due(),0);await c.query("update aerolog_records set data=jsonb_set(data,'{hours}','15') where organization_id=$1 and kind='asset' and id='QA-INSP-ASSET'",[org]);assert.equal(await due(),1);
await c.query('savepoint guard');try{await c.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'mission','QA-INSP-MISSION',$2)",[org,{id:'QA-INSP-MISSION',name:'Inspection guard test',aircraft:'QA inspection asset',date:today,time:'12:00',durationMinutes:60,altitude:60,status:'Pending approval',equipment:[],risks:[]}]);assert.fail('Due inspection mission accepted')}catch(e){assert.match(e.message,/inspection due or missing counters/);await c.query('rollback to savepoint guard')}

const event={id:'QA-IE',planId:'QA-PLAN',ruleId:'R',date:today,meters:{hours:15,flights:null,cycles:null},findings:'Inspected and confirmed operational',replacementSerial:''};const signed=await write('inspection_event',event);assert.equal(signed.data.signedById,actor);assert.equal(await due(),0);
await c.query('savepoint immutable');try{await write('inspection_event',event,1);assert.fail('Updated signed event')}catch(e){assert.match(e.message,/immutable/);await c.query('rollback to savepoint immutable')}
assert.equal((await c.query("select has_function_privilege('authenticated','public.aerolog_inspection_write(uuid,uuid,text,jsonb,integer)','execute') allowed")).rows[0].allowed,false);
await c.query('rollback');console.log('Inspection DB checks passed: frozen profile, due threshold, signed reset, immutable history, private write RPC. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
