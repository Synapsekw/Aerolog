import fs from 'node:fs';import pg from 'pg';import assert from 'node:assert/strict';import {loadEnv} from './env.mjs';
const e=loadEnv(),u=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());u.password=e.SUPABASE_DB_PASSWORD;
const c=new pg.Client({connectionString:u.toString(),ssl:{rejectUnauthorized:false}});await c.connect();
try {
 await c.query('begin');const org='2d1005c8-bea7-4a46-b863-c1afe8f31446',actor='30dd24a8-3fe1-48c4-b5ff-271cf663f223';
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
 const site={id:'QA-STORAGE',name:'Storage test',purpose:'Storage',archived:false};
 await c.query('select aerolog_catalog_write($1,$2,$3,$4,0)',[actor,org,'site',site]);
 const battery={id:'QA-STORAGE-BAT',model:'Physical pack label',aircraft:'Unassigned',cycles:0,health:null,temp:null,status:'Unverified',storageSiteId:site.id,productModel:'Verified TB65',manufacturer:'DJI',nominalVoltage:44.76,ratedCapacityMah:5880,notes:''};
 const save=(d,rev=0)=>c.query('select aerolog_command($1,$2)', ['save',{kind:'battery',data:d,revision:rev,_organizationId:org}]);
 await save(battery);
 const read=async()=>(await c.query("select data from aerolog_records where organization_id=$1 and kind='battery' and id=$2",[org,battery.id])).rows[0].data;
 assert.equal((await read()).storageSiteId,site.id);assert.equal((await read()).nominalVoltage,44.76);
 async function reject(d,pattern){await c.query('savepoint probe');try{await save({...battery,...d},1);assert.fail('Invalid equipment metadata accepted')}catch(e){assert.match(e.message,pattern);await c.query('rollback to savepoint probe');}}
 await reject({storageSiteId:'OTHER-ORG-SITE'},/not found in this organization/);
 await reject({ratedCapacityMah:-1},/Invalid ratedCapacityMah/);
 await c.query('select aerolog_catalog_write($1,$2,$3,$4,1)',[actor,org,'site',{...site,archived:true}]);
 await save({...battery,notes:'Archived storage assignment preserved'},1);
 assert.equal((await read()).storageSiteId,site.id);
 await c.query('savepoint archived');try{await save({...battery,id:'QA-NEW-BAT'});assert.fail('Archived storage assigned to new pack')}catch(e){assert.match(e.message,/active storage site/);await c.query('rollback to savepoint archived');}
 const operating={...site,id:'QA-OPERATING',purpose:'Operating area'};await c.query('select aerolog_catalog_write($1,$2,$3,$4,0)',[actor,org,'site',operating]);
 await c.query('savepoint operating');try{await save({...battery,storageSiteId:operating.id},2);assert.fail('Operating site used as storage')}catch(e){assert.match(e.message,/active storage site/);await c.query('rollback to savepoint operating');}
 await save({...battery,storageSiteId:''},2);assert.equal((await read()).storageSiteId,'');
 await c.query('rollback');console.log('Equipment storage checks passed: normal save RPC, typed metadata, foreign/missing site, invalid measurement, archive preservation, storage-only assignment and unassignment. Fixtures rolled back.');
}catch(e){await c.query('rollback');console.error(e.message);process.exitCode=1}finally{await c.end()}
