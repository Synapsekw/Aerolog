import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223',pilot='a03e4339-a2e8-4726-ab1a-54c44670c023';
 const doc={id:'QA-DOCUMENT',name:'Flight permit',category:'Permit',targetKind:'Organization',targetId:'',validFrom:'2026-01-01',expires:'2099-12-31',attachmentId:'',notes:'',archived:false};
 const write=(request,user=actor)=>c.query('select aerolog_document_write($1,$2,$3) result',[user,org,request]);
 async function reject(fn,pattern){await c.query('savepoint probe');try{await fn();assert.fail('Invalid operation accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await write({action:'save',data:doc,revision:0,submit:false});
 await reject(()=>write({action:'save',data:doc,revision:1,submit:true}),/with a file/);
 await reject(()=>write({action:'save',data:doc,revision:1,submit:false},pilot),/manager required/);
 const file={id:'QA-DOC-FILE',targetKind:'document',targetId:doc.id,name:'Permit.pdf',path:org+'/documents/QA-DOC-FILE',size:100,type:'application/pdf'};
 await c.query('select aerolog_document_attach($1,$2,$3)',[actor,org,file]);doc.attachmentId=file.id;
 await write({action:'save',data:doc,revision:1,submit:true});
 await c.query("update aerolog_organizations set settings=settings||'{\"allowSelfApproval\":false}' where id=$1",[org]);
 await reject(()=>write({action:'review',id:doc.id,revision:2,decision:'Approved',note:'Evidence reviewed'}),/different operations manager/);
 await c.query("update aerolog_organizations set settings=settings||'{\"allowSelfApproval\":true}' where id=$1",[org]);
 await write({action:'review',id:doc.id,revision:2,decision:'Approved',note:'Evidence reviewed'});
 const insert=(kind,data)=>c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);
 for(const id of ['QA-DOC-P','QA-DOC-O'])await insert('crew',{id,name:id,status:'Available',aircraftPermission:'All aircraft',expires:'2099-12-31'});
 await insert('asset',{id:'QA-DOC-A',name:'QA-DOC-A',category:'Aircraft',status:'Available',hours:1,next:100,intervalHours:100});
 const mission={id:'QA-DOC-M',name:'Document package',date:'2099-02-06',time:'10:00',durationMinutes:60,altitude:60,status:'Pending approval',pilot:'QA-DOC-P',observer:'QA-DOC-O',aircraft:'QA-DOC-A',equipment:[],risks:[],documentSelections:[{id:doc.id,revision:3}],documentSnapshots:[{name:'Forged'}]};
 await insert('mission',mission);
 const read=async()=>(await c.query("select data from aerolog_records where organization_id=$1 and kind='mission' and id=$2",[org,mission.id])).rows[0].data;
 assert.equal((await read()).documentSnapshots[0].name,doc.name);
 await write({action:'save',data:{...doc,name:'Later draft',expires:'2026-01-02'},revision:3,submit:false});
 await c.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'mission',$2,$3) on conflict(organization_id,kind,id) do update set data=excluded.data",[org,mission.id,{...mission,documentSelections:[],documentSnapshots:[]}]);assert.equal((await read()).documentSnapshots[0].revision,3);
 await reject(()=>insert('mission',{...mission,id:'QA-DOC-STALE',time:'12:00'}),/Document changed/);
 await reject(()=>insert('mission',{...mission,id:'QA-DOC-EXPIRED',time:'12:00',documentSelections:[{id:doc.id,revision:4}]}),/needs approval or is invalid/);
 await write({action:'save',data:{...doc,expires:'2026-01-02'},revision:4,submit:true});
 await write({action:'review',id:doc.id,revision:5,decision:'Approved',note:'Historical permit reviewed'});
 await reject(()=>insert('mission',{...mission,id:'QA-DOC-APPROVED-EXPIRED',time:'12:00',documentSelections:[{id:doc.id,revision:6}]}),/needs approval or is invalid/);
 await write({action:'save',data:{...doc,targetKind:'mission',targetId:mission.id},revision:6,submit:false});
 await reject(()=>insert('mission',{...mission,id:'QA-DOC-WRONG-SCOPE',status:'Draft',documentSelections:[{id:doc.id,revision:7}]}),/does not apply to this mission/);
 const history=(await c.query("select count(*)::int n from aerolog_records where organization_id=$1 and kind='document_revision' and data->>'documentId'=$2",[org,doc.id])).rows[0].n;assert.equal(history,7);
 await c.query('rollback');console.log('Document checks passed: role and self-review policy, required file, authoritative package version, stale/invalid documents and retained revision history. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
