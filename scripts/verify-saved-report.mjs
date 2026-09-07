// Read-only verification of a saved export against its frozen source snapshot.
// Usage: node --import tsx scripts/verify-saved-report.mjs <report-job-uuid>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';
import { reportPdf } from '../lib/reports/report-pdf.ts';
import { createFlightReport, reportCsv } from '../lib/reports/flight-report.ts';

const id = process.argv[2];
assert.match(id || '', /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  'Provide the saved report job UUID');
const env = loadEnv();
const connection = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
connection.password = env.SUPABASE_DB_PASSWORD;
const db = new pg.Client({ connectionString: connection.toString(), ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  // Preserve the same Postgres JSON timestamp representation used by the worker.
  const job = (await db.query('select to_jsonb(j) job from aerolog_report_jobs j where id=$1', [id])).rows[0]?.job;
  assert.ok(job, 'Report job not found');
  assert.equal(job.status, 'Completed');
  assert.equal(job.snapshot.version, 1, 'Unsupported snapshot version');
  const attachment = (await db.query(
    "select data from aerolog_records where organization_id=$1 and kind='attachment' and id=$2",
    [job.organization_id, job.attachment_id],
  )).rows[0]?.data;
  assert.ok(attachment, 'Report attachment missing');
  assert.equal(attachment.targetId, id);
  assert.ok(attachment.path.startsWith(`${job.organization_id}/reports/${id}/`));
  const storage = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const download = await storage.storage.from('aerolog-files').download(attachment.path);
  assert.equal(download.error, null, 'Saved artifact download failed');
  const bytes = Buffer.from(await download.data.arrayBuffer());
  assert.equal(bytes.length, attachment.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), job.sha256);
  const report = createFlightReport(job.request, job.snapshot.records, job.snapshot.members);
  const reproduced = job.request.format === 'PDF' ? Buffer.from(await reportPdf(report, job.snapshot.organization, job.created_at)) : Buffer.from(reportCsv(report, job.snapshot.organization, job.created_at), 'utf8');
  assert.ok(bytes.equals(reproduced), 'Saved bytes differ from snapshot reproduction');
  assert.equal(report.flightCount, job.summary.flightCount);
  assert.equal(report.durationSeconds, job.summary.durationSeconds);
  console.log(JSON.stringify({ id, flights: report.flightCount, seconds: report.durationSeconds,
    bytes: bytes.length, sha256Verified: true, snapshotReproductionVerified: true }));
} finally {
  await db.end();
}
