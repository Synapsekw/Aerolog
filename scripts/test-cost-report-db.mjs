// Run with: node --import tsx scripts/test-cost-report-db.mjs
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './env.mjs';
import { organizationCosts, organizationCostsCsv } from '../lib/reports/organization-costs.ts';
const env = loadEnv();
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
url.password = env.SUPABASE_DB_PASSWORD;
const db = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query('begin');
  const org = '2d1005c8-bea7-4a46-b863-c1afe8f31446';
  const actor = '30dd24a8-3fe1-48c4-b5ff-271cf663f223';
  const insert = (kind, data) => db.query('insert into aerolog_records(organization_id,kind,id,data) values($1,$2,$3,$4)', [org,kind,data.id,data]);
  await insert('asset', {id:'QA-HISTORY-ASSET',name:'QA history aircraft',category:'Aircraft',status:'Available',hours:10,next:100,intervalHours:100});
  await insert('project', {id:'QA-COST-REPORT-PROJECT',name:'Captured project',reference:'PROJECT-REF',archived:false});
  const service = {projectId:'QA-COST-REPORT-PROJECT',id:'QA-HISTORY-SERVICE',asset:'QA history aircraft',targetKind:'asset',targetId:'QA-HISTORY-ASSET',task:'Original task',status:'Scheduled',due:'2026-09-07',technician:'QA technician',intervalHours:100,remaining:90,cost:12.345,currency:'KWD'};
  await insert('service',service);
  const request = {type:'Maintenance costs',from:'2026-09-01',to:'2026-09-30',format:'CSV',projectScope:{mode:'project',projectId:'QA-COST-REPORT-PROJECT'}};
  const id = randomUUID();
  await db.query('select aerolog_report_enqueue($1,$2,$3,$4)',[actor,org,id,request]);
  const claim = async () => (await db.query('select aerolog_report_claim($1,$2,$3) job',[actor,org,id])).rows[0].job;
  const first = await claim();
  const calculate = job => organizationCosts(job.snapshot.records,job.request.from,job.request.to,job.request.projectScope);
  const report = calculate(first);
  assert.ok(first.snapshot.records.every(r=>r.kind==='service'));
  const source = report.rows.find(r=>r[3]===service.id);
  assert.equal(source[4],'Original task');
  assert.equal(source[7],12.345);
  assert.equal(source[15],'Captured project');
  assert.equal(report.rows.length,1);
  const original = organizationCostsCsv(report,first.snapshot.organization,first.created_at);
  await db.query("update aerolog_records set data=data||$3::jsonb,revision=revision+1 where organization_id=$1 and kind='service' and id=$2",[org,service.id,JSON.stringify({task:'Later edit',cost:999,due:'2027-01-01'})]);
  await db.query("update aerolog_report_jobs set lease_until=now()-interval '1 minute' where id=$1",[id]);
  const resumed = await claim();
  assert.equal(resumed.attempts,2);
  assert.equal(organizationCostsCsv(calculate(resumed),resumed.snapshot.organization,resumed.created_at),original);
  assert.equal(calculate(resumed).rows.find(r=>r[3]===service.id)[9],1);
  await db.query('rollback');
  console.log('Saved cost checks passed: service-only snapshot, cost/date/task capture, source revision and identical CSV after edits and recovery. Fixtures rolled back.');
} catch (error) {
  await db.query('rollback');
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.end(); }
