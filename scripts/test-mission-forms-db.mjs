import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 const template={id:'QA-FORM',name:'Preflight v1',type:'Custom form',notes:'Read carefully',archived:false,hazards:[],fields:[{id:'check',label:'Propellers inspected',type:'Check',required:true,options:[]},{id:'wind',label:'Wind speed',type:'Number',required:true,options:[]},{id:'weather',label:'Weather',type:'Choice',required:true,options:['Clear','Cloudy']}]};
 const write=(t,rev=0)=>c.query('select aerolog_form_template_write($1,$2,$3,$4)',[actor,org,t,rev]);
 await write(template);
 const insert=(kind,data)=>c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 for(const id of ['QA-F-P','QA-F-O']) await insert('crew',{id,name:id,status:'Available',expires:'2099-12-31'});
 await insert('asset',{id:'QA-F-A',name:'QA-F-A',category:'Aircraft',status:'Available',hours:1,next:100,intervalHours:100});
 let mission={id:'QA-F-M',name:'Forms mission',location:'QA area',type:'Survey',status:'Draft',date:'2099-02-04',time:'10:00',durationMinutes:60,altitude:60,pilot:'QA-F-P',observer:'QA-F-O',aircraft:'QA-F-A',equipment:[],risks:[{hazard:'QA risk',likelihood:1,severity:1,controlled:true,mitigation:'QA controls'}],forms:[{templateId:template.id,revision:1,answers:{}}],formSnapshots:[{id:template.id,name:'Forged'}]};
 const save=(m,rev=0)=>c.query('select aerolog_command($1,$2)', ['save',{kind:'mission',data:m,revision:rev,_organizationId:org}]);
 const read=async()=>(await c.query("select data from aerolog_records where organization_id=$1 and kind='mission' and id=$2",[org,mission.id])).rows[0].data;
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await save(mission);mission=await read();assert.equal(mission.formSnapshots[0].name,template.name);
 await reject(()=>save({...mission,status:'Pending approval'},1),/Complete required form field/);
 await reject(()=>save({...mission,forms:[{...mission.forms[0],answers:{check:true,wind:'bad',weather:'Clear'}}]},1),/Invalid form answer type/);
 await reject(()=>save({...mission,forms:[{...mission.forms[0],answers:{check:true,wind:3,weather:'Rain'}}]},1),/Invalid form choice/);
 await reject(()=>save({...mission,forms:[{...mission.forms[0],answers:{invented:'anything'}}]},1),/Unknown form field/);
 await write({...template,name:'Preflight v2',fields:[]},1);
 await reject(()=>save({...mission,id:'QA-F-M-STALE'},0),/Template changed/);
 mission.forms[0].answers={check:true,wind:3.5,weather:'Clear'};
 await save({...mission,status:'Pending approval'},1);
 const submitted=await read();assert.equal(submitted.formSnapshots[0].name,'Preflight v1');
 await c.query("update aerolog_records set data=data||$3::jsonb where organization_id=$1 and kind='mission' and id=$2",[org,mission.id,JSON.stringify({forms:[],formSnapshots:[]})]);
 assert.deepEqual((await read()).forms,submitted.forms);assert.deepEqual((await read()).formSnapshots,submitted.formSnapshots);
 await reject(()=>write(template,0),/Template changed/);
 const priv=await c.query("select has_function_privilege('authenticated','public.aerolog_form_template_write(uuid,uuid,jsonb,integer)','execute') allowed");assert.equal(priv.rows[0].allowed,false);
 await c.query('rollback');console.log('Mission form checks passed: authoritative snapshots, required fields, typed answers, choices, unknown fields, stale versions, normal save submission and locked submitted answers. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
