import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const env=loadEnv(),url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());url.password=env.SUPABASE_DB_PASSWORD;const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query('begin');if(process.argv.includes('--preview-migration'))await db.query(fs.readFileSync('supabase/migrations/202609070049_canonical_flight_import.sql','utf8'));
 const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 const insert=(kind,id,data)=>db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)',[org,kind,id,{id,...data}]);
 for(const id of ['QA-IMPORT-OLD','QA-IMPORT-NEW'])await insert('asset',id,{name:id,category:'Aircraft',hours:10,next:100,intervalHours:100,status:'Available'});
 for(const id of ['QA-PACK-OLD','QA-PACK-NEW','QA-PACK-SECOND'])await insert('battery',id,{model:id,aircraft:'QA-IMPORT-OLD',cycles:40,health:90,temp:20,status:'Quarantined'});
 await insert('crew','QA-IMPORT-CREW',{name:'QA import pilot'});
 for(const [kind,oldId,newId] of [['asset','QA-IMPORT-OLD','QA-IMPORT-NEW'],['battery','QA-PACK-OLD','QA-PACK-NEW']])await db.query('insert into aerolog_equipment_aliases(organization_id,kind,source_id,canonical_id,created_by)values($1,$2,$3,$4,$5)',[org,kind,oldId,newId,actor]);
 const flight={id:'QA-CANONICAL-FLIGHT',pilot:'QA import pilot',aircraftId:'QA-IMPORT-OLD',aircraft:'QA-IMPORT-OLD',date:'2026-09-07',durationSeconds:600,altitude:60,distance:'2.5',telemetry:[],battery:'QA-PACK-OLD',batteryIds:['QA-PACK-OLD','QA-PACK-NEW','QA-PACK-SECOND'],equipmentIds:['QA-IMPORT-OLD','QA-IMPORT-NEW'],source:'CSV',importHash:'QA-canonical-import-hash',equipmentIdentitySource:{forged:true}};
 const run=doc=>db.query("select aerolog_command('flight_import',$1)",[{kind:'flight',revision:0,data:doc,_organizationId:org}]);
 const get=async(kind,id)=>(await db.query('select data,revision from aerolog_records where organization_id=$1 and kind=$2 and id=$3',[org,kind,id])).rows[0];
 await run(flight);const saved=(await get('flight',flight.id)).data;assert.equal(saved.aircraftId,'QA-IMPORT-NEW');assert.equal(saved.aircraft,'QA-IMPORT-NEW');assert.equal(saved.battery,'QA-PACK-NEW');assert.deepEqual(saved.batteryIds,['QA-PACK-NEW','QA-PACK-SECOND']);assert.deepEqual(saved.equipmentIds,['QA-IMPORT-NEW']);assert.equal(saved.equipmentIdentitySource.aircraftId,'QA-IMPORT-OLD');assert.equal(saved.equipmentIdentitySource.forged,undefined);
 assert.equal((await get('asset','QA-IMPORT-OLD')).data.hours,10);assert.equal((await get('asset','QA-IMPORT-NEW')).data.hours,10.167);
 const events=(await db.query("select data from aerolog_records where organization_id=$1 and kind='battery_event' and data->>'flightId'=$2",[org,flight.id])).rows;
 assert.deepEqual(events.map(e=>e.data.battery).sort(),['QA-PACK-NEW','QA-PACK-SECOND']);assert.equal((await get('battery','QA-PACK-NEW')).data.cycles,40);assert.equal((await get('battery','QA-PACK-NEW')).data.status,'Quarantined');
 async function reject(doc,pattern){await db.query('savepoint rejected');try{await run(doc);assert.fail('Invalid import accepted')}catch(e){assert.match(e.message,pattern)}finally{await db.query('rollback to savepoint rejected')}}
 await reject({...flight,id:'QA-DUPLICATE-FLIGHT'},/duplicate key/);assert.equal((await get('asset','QA-IMPORT-NEW')).data.hours,10.167);
 await reject({...flight,id:'QA-BAD-FLIGHT',aircraftId:'foreign-id'},/Register this aircraft/);
 await reject({...flight,id:'QA-BAD-PACK',batteryIds:['foreign-pack']},/Equipment identity not found/);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.aerolog_route_flight_equipment(uuid,jsonb)','execute') allowed")).rows[0].allowed,false);
 await db.query('rollback');console.log('Canonical flight import passed: retained original identity, typed resolution, deduplicated multi-pack events, canonical-only hours, unchanged cycles/quarantine, duplicate rollback and foreign identity rejection. Fixtures rolled back.');
}catch(e){await db.query('rollback');console.error(e.message);process.exitCode=1}finally{await db.end()}
