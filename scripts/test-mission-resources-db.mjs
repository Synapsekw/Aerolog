import fs from'node:fs';import assert from'node:assert/strict';import pg from'pg';import{loadEnv}from'./env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try{await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
async function insert(kind,data){await c.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,data.id,data]);}
async function rejects(data,pattern){await c.query('savepoint probe');try{await insert('mission',data);assert.fail('Invalid assignment accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
for(const id of ['QA-A1','QA-A2','QA-A3'])await insert('asset',{id,name:id,category:'Aircraft',serial:id,status:'Available',hours:1,next:100,intervalHours:100});
for(const name of ['QA-P1','QA-P2','QA-P3','QA-P4','QA-OP'])await insert('crew',{id:name,name,status:'Available',expires:'2099-12-31'});
await insert('battery',{id:'QA-B',model:'QA',aircraft:'QA-A2',status:'Healthy',cycles:0,health:95,temp:30});
const base={id:'QA-M1',name:'Resource test',location:'QA',date:'2099-01-01',time:'10:00',durationMinutes:60,altitude:60,status:'Pending approval',pilot:'QA-P1',observer:'QA-P2',aircraft:'QA-A1',additionalAircraft:['QA-A2'],crewAssignments:[{name:'QA-OP',role:'Ground support'}],equipment:['QA-B'],risks:[]};
await insert('mission',base);
await rejects({...base,id:'QA-M2',pilot:'QA-P3',observer:'QA-P4',aircraft:'QA-A3',additionalAircraft:['QA-A2'],crewAssignments:[],equipment:[]},/Resource conflict/);
await rejects({...base,id:'QA-M3',pilot:'QA-P3',observer:'QA-P4',aircraft:'QA-A3',additionalAircraft:[],equipment:[]},/Resource conflict/);
await rejects({...base,id:'QA-M4',time:'12:00',additionalAircraft:['QA-MISSING']},/unavailable/);
await rejects({...base,id:'QA-M5',time:'12:00',additionalAircraft:[]},/Battery .*compatibility/);
const disabled=(await c.query('select display_name,user_id from aerolog_memberships where organization_id=$1 and not active limit 1',[org])).rows[0];assert.ok(disabled);
await insert('crew',{id:'QA-DISABLED',name:'QA disabled member',authUserId:disabled.user_id,status:'Available',expires:'2099-12-31'});
await rejects({...base,id:'QA-M6',time:'12:00',crewAssignments:[{name:'QA disabled member',role:'Second pilot'}]},/disabled organization access/);
await insert('mission',{...base,id:'QA-M7',time:'11:00'});
await c.query("select set_config('request.jwt.claim.sub',$1,true)",['30dd24a8-3fe1-48c4-b5ff-271cf663f223']);
const rpcMission={...base,id:'QA-M-RPC',time:'14:00',risks:[{hazard:'QA hazard',likelihood:1,severity:1,mitigation:'QA control',controlled:true}]};
const rpc=await c.query('select aerolog_command($1,$2) result',['save',{kind:'mission',data:rpcMission,revision:0,_organizationId:org}]);assert.equal(rpc.rows[0].result.data.status,'Pending approval');
await c.query('rollback');console.log('Mission DB checks passed: extra aircraft conflict, extra crew conflict, missing aircraft, incompatible battery, disabled member rejection, adjacent windows. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
