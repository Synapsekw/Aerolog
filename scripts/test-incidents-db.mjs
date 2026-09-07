import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',pilot='a03e4339-a2e8-4726-ab1a-54c44670c023';
 const base={id:'QA-INCIDENT',title:'Test incident',occurredAt:'2026-09-06T12:00:00Z',severity:'Low',status:'Reported',flightId:'',siteId:'',projectId:'',equipment:[],personnelIds:[],narrative:'QA report narrative',damage:'None observed',cause:'',resolution:'',actions:[{id:'QA-ACTION',task:'Review equipment',assignedTo:actor,due:'2026-09-10',done:false,completionNotes:''}]};
 const write=(doc,rev=0,user=actor)=>c.query('select aerolog_incident_write($1,$2,$3,$4) result',[user,org,doc,rev]);
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 let result=await write(base,0,pilot);assert.equal(result.rows[0].result.reportedById,pilot);
 await reject(()=>write({...base,status:'Closed',resolution:'Resolved correctly',actions:[]},1,pilot),/Only managers/);
 await reject(()=>write({...base,status:'Closed',resolution:'Resolved correctly'},1),/Finish actions/);
 await reject(()=>write({...base,flightId:'OTHER-ORG-FLIGHT'},1),/not found in this organization/);
 await reject(()=>write(base,0),/Incident changed/);
 result=await write({...base,status:'Investigating'},1);assert.equal(result.rows[0].result.reportedById,pilot);
 await reject(()=>write({...base,title:'Reporter edit'},2,pilot),/Only managers/);
 const closed={...base,status:'Closed',resolution:'Inspection complete, findings addressed',actions:[{...base.actions[0],done:true,completionNotes:'Inspection completed'}]};
 result=await write(closed,2);assert.ok(result.rows[0].result.closedAt);assert.ok(result.rows[0].result.actions[0].completedAt);assert.notEqual(result.rows[0].result.actions[0].completedBy,'');
 const file={id:'QA-INCIDENT-FILE',targetKind:'incident',targetId:base.id,path:org+'/incidents/QA-INCIDENT-FILE',name:'QA evidence.txt',size:10,type:'text/plain'};
 const attach=(doc,user=actor)=>c.query('select aerolog_incident_attach($1,$2,$3)',[user,org,doc]);
 await reject(()=>attach(file),/open incident/);
 await write({...closed,status:'Investigating'},3);
 await reject(()=>attach({...file,path:'other-org/path'}),/Invalid incident attachment path/);
 await attach(file);
 const attachment=(await c.query("select data from aerolog_records where organization_id=$1 and kind='attachment' and id=$2",[org,file.id])).rows[0].data;assert.ok(attachment.uploadedBy);
 await write({...base,id:'QA-ADMIN-INCIDENT'},0,actor);
 await reject(()=>write({...base,id:'QA-ADMIN-INCIDENT'},1,pilot),/Only managers/);
 const permissions=await c.query("select has_function_privilege('authenticated','public.aerolog_incident_write(uuid,uuid,jsonb,integer)','execute') allowed");assert.equal(permissions.rows[0].allowed,false);
 await c.query('rollback');console.log('Incident checks passed: reporter identity, ownership, manager closure, incomplete actions, reference isolation, revisions, completion attribution, evidence path and closed-incident guards. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
