import fs from 'node:fs';
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './env.mjs';
const env = loadEnv(),
  url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
url.password = env.SUPABASE_DB_PASSWORD;
const db = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await db.connect();
try {
  await db.query('BEGIN');
  const {
    rows: [actor],
  } = await db.query(
    "select id,organization_id from public.aerolog_profiles where role='admin' and active limit 1",
  );
  assert(
    actor,
    'An active administrator is needed for the rollback-only test.',
  );
  const id = 'ENRICH-TEST-' + randomUUID();
  const original = {
    id,
    mission: 'ROLLBACK-ONLY ENRICHMENT TEST',
    pilot: 'Test',
    aircraft: 'Test',
    date: '2026-09-06',
    duration: '10:00',
    durationSeconds: 600,
    distance: '1',
    altitude: 10,
    start: null,
    end: null,
    battery: '',
    source: 'Manual',
    telemetry: [],
    flightTrack: [
      [55, 25, 10],
      [55.001, 25, 10],
    ],
    notes: '',
  };
  await db.query(
    "insert into public.aerolog_records(organization_id,kind,id,data,created_by) values($1,'flight',$2,$3,$4)",
    [actor.organization_id, id, original, actor.id],
  );
  const before = await db.query(
    "select id,data,revision from public.aerolog_records where organization_id=$1 and kind in ('asset','battery','battery_event') order by kind,id",
    [actor.organization_id],
  );
  const patch = {
    telemetry: [
      { time: 0, longitude: 55, latitude: 25, altitude: 10 },
      { time: 10, longitude: 55.001, latitude: 25, altitude: 10 },
    ],
  };
  const args = [
    actor.id,
    actor.organization_id,
    id,
    1,
    patch,
    'a'.repeat(64),
    'Reviewed source time, aircraft and track in rollback-only test.',
  ];
  await db.query(
    'select public.aerolog_enrich_flight($1,$2,$3,$4,$5,$6,$7)',
    args,
  );
  const {
    rows: [saved],
  } = await db.query(
    "select data,revision from public.aerolog_records where organization_id=$1 and kind='flight' and id=$2",
    [actor.organization_id, id],
  );
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.durationSeconds, 600);
  assert.equal(saved.data.telemetry.length, 2);
  assert.deepEqual(saved.data.flightTrack, original.flightTrack);
  const after = await db.query(
    "select id,data,revision from public.aerolog_records where organization_id=$1 and kind in ('asset','battery','battery_event') order by kind,id",
    [actor.organization_id],
  );
  assert.deepEqual(after.rows, before.rows);
  const {
    rows: [audit],
  } = await db.query(
    "select count(*)::int as count from public.aerolog_audit where record_id=$1 and action='flight_telemetry_enriched'",
    [id],
  );
  assert.equal(audit.count, 1);
  await db.query('SAVEPOINT stale');
  await assert.rejects(
    db.query('select public.aerolog_enrich_flight($1,$2,$3,$4,$5,$6,$7)', args),
    /Flight changed/,
  );
  await db.query('ROLLBACK TO SAVEPOINT stale');
  const {
    rows: [permissions],
  } = await db.query(
    "select has_function_privilege('authenticated','public.aerolog_enrich_flight(uuid,uuid,text,integer,jsonb,text,text)','EXECUTE') as allowed",
  );
  assert.equal(permissions.allowed, false);
  console.log(
    'PASS enrichment: retained accounting/geometry, unchanged fleet and events, audit, stale revision rejection and RPC permissions. All test writes rolled back.',
  );
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
