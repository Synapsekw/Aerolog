// Run with: node --import tsx scripts/test-report-history-db.mjs
import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './env.mjs';
import { createFlightReport, reportCsv } from '../lib/reports/flight-report.ts';
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
  const service = {id:'QA-HISTORY-SERVICE',asset:'QA history aircraft',targetKind:'asset',targetId:'QA-HISTORY-ASSET',task:'Original task',status:'Scheduled',due:'2026-09-07',technician:'QA technician',intervalHours:100,remaining:90,cost:12.345,currency:'KWD'};
  await insert('service',service);
  const request = {type:'Aircraft',entityId:'QA-HISTORY-ASSET',from:'2026-09-01',to:'2026-09-30',includeHistory:true};
  const id = randomUUID();
  await db.query('select aerolog_report_enqueue($1,$2,$3,$4)',[actor,org,id,request]);
  const claim = async () => (await db.query('select aerolog_report_claim($1,$2,$3) job',[actor,org,id])).rows[0].job;
  const first = await claim();
  const calculate = job => createFlightReport(job.request,job.snapshot.records,job.snapshot.members);
  const report = calculate(first);
  assert.equal(report.history.rows.length,1);
  assert.equal(report.history.rows[0][4],'Original task');
  assert.equal(report.history.rows[0][7],12.345);
  const original = reportCsv(report,first.snapshot.organization,first.created_at);
  await db.query("update aerolog_records set data=data||$3::jsonb,revision=revision+1 where organization_id=$1 and kind='service' and id=$2",[org,service.id,JSON.stringify({task:'Later edit',cost:999,due:'2027-01-01'})]);
  await db.query("update aerolog_report_jobs set lease_until=now()-interval '1 minute' where id=$1",[id]);
  const resumed = await claim();
  assert.equal(resumed.attempts,2);
  assert.equal(reportCsv(calculate(resumed),resumed.snapshot.organization,resumed.created_at),original);
  assert.equal(calculate(resumed).history.sourceReferences.find(r=>r.id===service.id).revision,1);
  await db.query('rollback');
  console.log('Saved history checks passed: typed source capture, cost/date/task snapshot, source revision and identical CSV after edits and recovery. Fixtures rolled back.');
} catch (error) {
  await db.query('rollback');
  console.error(error.message);
  process.exitCode = 1;
} finally { await db.end(); }
