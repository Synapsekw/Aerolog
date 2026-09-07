import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
 const insert=(kind,data)=>c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 const update=(kind,id,patch)=>c.query('update aerolog_records set data=data||$4::jsonb where organization_id=$1 and kind=$2 and id=$3',[org,kind,id,JSON.stringify(patch)]);
 for(const id of ['QA-READY-A1','QA-READY-A2'])await insert('asset',{id,name:id,category:'Aircraft',status:'Available',hours:1,next:100,intervalHours:100});
 for(const id of ['QA-READY-P','QA-READY-O','QA-READY-S'])await insert('crew',{id,name:id,status:'Available',expires:'2099-12-31'});
 const mission={id:'QA-READY-M',name:'Readiness checks',date:'2099-02-05',time:'10:00',durationMinutes:60,altitude:60,status:'Pending approval',pilot:'QA-READY-P',observer:'QA-READY-O',aircraft:'QA-READY-A1',equipment:[],risks:[]};
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await reject(()=>insert('mission',mission),/Configure aircraft permissions/);
 await update('crew','QA-READY-P',{aircraftPermission:'Selected aircraft',authorizedAircraftIds:[]});
 await reject(()=>insert('mission',mission),/not authorized/);
 await update('crew','QA-READY-P',{authorizedAircraftIds:['QA-READY-A1']});
 await reject(()=>insert('mission',{...mission,additionalAircraft:['QA-READY-A2']}),/not authorized/);
 await reject(()=>insert('mission',{...mission,crewAssignments:[{name:'QA-READY-S',role:'Second pilot'}]}),/Configure aircraft permissions/);
 const q={id:'QA-QUAL',name:'Operational endorsement',issued:'2098-01-01',expires:'2099-12-31',requiredForOperations:true,evidenceId:''};
 await update('crew','QA-READY-O',{qualifications:[q]});
 await reject(()=>insert('mission',mission),/qualification .*requires valid dates and evidence/);
 await reject(()=>update('crew','QA-READY-P',{authorizedAircraftIds:['OTHER-ORG-AIRCRAFT']}),/not found in this organization/);
 const file={id:'QA-PERSON-FILE',targetKind:'crew',targetId:'QA-READY-O',name:'Endorsement.pdf',path:org+'/personnel/QA-PERSON-FILE',size:100,type:'application/pdf'};
 await c.query('select aerolog_crew_attach($1,$2,$3)',['30dd24a8-3fe1-48c4-b5ff-271cf663f223',org,file]);
 await reject(()=>update('crew','QA-READY-P',{qualifications:[{...q,evidenceId:file.id}]}),/evidence must belong to this person/);
 await update('crew','QA-READY-O',{qualifications:[{...q,evidenceId:file.id,expires:'2098-12-31'}]});
 await reject(()=>insert('mission',mission),/qualification .*requires valid dates and evidence/);
 await update('crew','QA-READY-O',{qualifications:[{...q,evidenceId:file.id}]});
 await insert('mission',mission);
 await c.query('rollback');console.log('Personnel checks passed: explicit policy, empty allowlist, multiple aircraft and second-pilot authorization, expiry/evidence, evidence ownership and org isolation. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
