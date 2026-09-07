import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import { loadEnv } from './env.mjs';
const env = loadEnv(), url = new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());
url.password = env.SUPABASE_DB_PASSWORD;
const db = new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});
await db.connect();
try {
  await db.query('begin');
  const org='2d1005c8-bea7-4a46-b863-c1afe8f31446';
  const member=(await db.query("select user_id,display_name from aerolog_memberships m where organization_id=$1 and active and not exists(select 1 from aerolog_records r where r.organization_id=m.organization_id and r.kind='crew' and r.data->>'authUserId'=m.user_id::text) limit 1",[org])).rows[0];
  assert.ok(member,'An unlinked active member is needed for this rollback check');
  const record={id:'QA-MEMBERSHIP-CREW',name:member.display_name,authUserId:member.user_id,status:'Unavailable',cert:'QA only',expires:'2099-12-31'};
  const save=data=>db.query("insert into aerolog_records(organization_id,kind,id,data) values($1,'crew',$2,$3) on conflict(organization_id,kind,id) do update set data=excluded.data",[org,data.id,data]);
  async function reject(fn,pattern){await db.query('savepoint probe');try{await fn();assert.fail('Unexpected acceptance')}catch(e){assert.match(e.message,pattern);await db.query('rollback to savepoint probe')}}
  await reject(()=>save({...record,authUserId:'00000000-0000-4000-8000-000000000001'}),/active member/);
  await reject(()=>save({...record,name:'Wrong identity'}),/name must match/);
  await save(record);
  await save({...record,notes:'Upsert retains identity'});
  await reject(()=>save({...record,id:'QA-MEMBERSHIP-DUPLICATE'}),/already has a crew profile/);
  await reject(()=>save({...record,authUserId:undefined}),/cannot be reassigned/);
  await db.query('rollback');
  console.log('Crew membership checks passed: org scope, matching identity, upsert, duplicates and immutable link. Fixtures rolled back.');
} catch(e) { await db.query('rollback');console.error(e.message);process.exitCode=1; }
finally { await db.end(); }
