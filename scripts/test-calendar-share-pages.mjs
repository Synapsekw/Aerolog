import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnv} from './env.mjs';
const env=loadEnv(),base='http://127.0.0.1:3000',org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const ids=Array.from({length:101},()=>randomUUID());
try {
 const inserted=await db.from('aerolog_calendar_shares').insert(ids.map(id=>({id,organization_id:org,created_by:'30dd24a8-3fe1-48c4-b5ff-271cf663f223',label:'TEST pagination fixture',token_hash:randomBytes(32).toString('hex'),date_from:'2026-01-01',date_to:'2026-12-31',kinds:['mission'],expires_at:new Date().toISOString(),revoked_at:new Date().toISOString()})));
 assert.equal(inserted.error,null,'Fixture insertion failed');
 const auth=await fetch(base+'/api/local-login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({role:'admin'})});assert.equal(auth.status,200);const {session}=await auth.json();
 const headers={Authorization:'Bearer '+session.access_token,'X-Aerolog-Organization':org};
 const seen=new Set();let pages=0;
 while(pages<100){const response=await fetch(base+'/api/calendar-shares?page='+pages,{headers});assert.equal(response.status,200);const result=await response.json();assert.ok(result.shares.length<=25);for(const row of result.shares){assert.equal('token_hash' in row,false);assert.ok(!seen.has(row.id),'Duplicate page entry');seen.add(row.id)}pages++;if(!result.hasMore)break;}
 assert.ok(ids.every(id=>seen.has(id)),'Older fixture links are inaccessible');assert.ok(pages>=5);
 assert.equal((await fetch(base+'/api/calendar-shares?page=-1',{headers})).status,400);
 assert.equal((await fetch(base+'/api/calendar-shares')).status,401);
 console.log('Calendar pagination API passed: 101 fixtures accessible, no duplicates/token hashes, invalid page and anonymous requests rejected.');
} finally {
 const removed=await db.from('aerolog_calendar_shares').delete().eq('organization_id',org).in('id',ids);
 assert.equal(removed.error,null,'Fixture cleanup failed');
 console.log('Temporary revoked calendar links removed.');
}
