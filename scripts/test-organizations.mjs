import { loadEnv } from './env.mjs';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
const e = loadEnv(),
  db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  }),
  tag = 'ORGTEST-' + randomUUID().slice(0, 8),
  users = [],
  orgs = [],
  tokens = {};
let checks = 0;
const ok = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
async function request(
  who,
  body,
  status = 200,
  path = 'organizations',
  method = 'POST',
  headers = {},
) {
  const r = await fetch('http://127.0.0.1:3000/api/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + tokens[who],
      'Content-Type': 'application/json',
      ...headers,
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, status, d.error || path);
  checks++;
  return d;
}
try {
  for (const who of ['owner', 'pilot', 'outsider']) {
    const email = tag.toLowerCase() + '-' + who + '@aerolog.example',
      password = randomBytes(24).toString('base64url');
    const u = ok(
      await db.auth.admin.createUser({ email, password, email_confirm: true }),
    ).user;
    users.push(u.id);
    const c = createClient(
      e.NEXT_PUBLIC_SUPABASE_URL,
      e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    tokens[who] = ok(
      await c.auth.signInWithPassword({ email, password }),
    ).session.access_token;
  }
  const first = (
    await request('owner', {
      action: 'create',
      name: tag,
      displayName: 'Owner',
    })
  ).id;
  orgs.push(first);
  const invite = await request('owner', {
    action: 'invite',
    email: tag.toLowerCase() + '-pilot@aerolog.example',
    role: 'pilot',
  });
  await request('outsider', { action: 'join', code: invite.code }, 400);
  await request(
    'pilot',
    { action: 'join', code: invite.code, displayName: 'Owner' },
    400,
  );
  await request('pilot', {
    action: 'join',
    code: invite.code,
    displayName: 'Pilot',
  });
  await request('pilot', { action: 'join', code: invite.code }, 400);
  await request(
    'pilot',
    { action: 'invite', email: 'x@aerolog.example', role: 'admin' },
    403,
  );
  await request(
    'pilot',
    { name: 'Bad', logoData: null },
    403,
    'organizations',
    'PATCH',
  );
  await request(
    'owner',
    { name: tag, logoData: 'data:image/png;base64,aGVsbG8=' },
    400,
    'organizations',
    'PATCH',
  );
  const logo =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI1sAAAAASUVORK5CYII=';
  await request(
    'owner',
    { name: tag + ' branded', logoData: logo },
    200,
    'organizations',
    'PATCH',
  );
  let store = await request('pilot', null, 200, 'bootstrap', 'GET');
  assert.equal(store.organization.logo_data, logo);
  assert.equal(store.profiles.length, 2);
  const save = (kind, data) =>
    request(
      'owner',
      { command: 'save', payload: { kind, data, revision: 0 } },
      200,
      'commands',
    );
  await save('asset', {
    id: tag + '-A',
    name: 'Test aircraft',
    category: 'Aircraft',
    serial: tag,
    status: 'Available',
    hours: 0,
    next: 100,
    intervalHours: 100,
    pilot: 'Unassigned',
    notes: '',
  });
  await save('crew', {
    id: tag + '-C',
    name: 'Pilot',
    initials: 'P',
    role: 'Pilot',
    hours: 0,
    flights: 0,
    cert: 'TEST',
    expires: '2027-12-31',
    status: 'Available',
    authUserId: users[1],
    notes: '',
  });
  const flight = {
    id: tag + '-F',
    mission: 'Test',
    pilot: 'Pilot',
    aircraft: 'Test aircraft',
    date: '2026-09-06',
    duration: '10:00',
    durationSeconds: 600,
    distance: '1',
    altitude: 20,
    start: null,
    end: null,
    battery: '',
    notes: '',
    source: 'CSV',
    importHash: tag,
    telemetry: [],
  };
  await request(
    'pilot',
    {
      command: 'flight_import',
      payload: { kind: 'flight', data: flight, revision: 0 },
    },
    200,
    'commands',
  );
  store = await request('owner', null, 200, 'bootstrap', 'GET');
  const flights = store.records.filter((r) => r.kind === 'flight');
  assert.equal(
    flights.reduce((s, f) => s + f.data.durationSeconds, 0),
    600,
  );
  assert.equal(flights[0].data.pilotUserId, users[1]);
  await request(
    'pilot',
    {
      command: 'flight_import',
      payload: {
        kind: 'flight',
        data: { ...flight, id: tag + '-duplicate' },
        revision: 0,
      },
    },
    400,
    'commands',
  );
  // End-to-end import preview, reviewed enrichment, persistence and raw archive.
  const usageBeforeEnrichment = store.records.find((r) => r.id === tag + '-A')
    .data.hours;
  const rawLog = JSON.stringify({
    ...flight,
    id: undefined,
    importHash: undefined,
    durationSeconds: 900,
    aircraftSerial: 'TEST-SN',
    startedAt: '2026-09-06T10:00:00Z',
    telemetry: [
      { time: 0, longitude: 55, latitude: 25, altitude: 10, voltage: 24 },
      { time: 10, longitude: 55.001, latitude: 25, altitude: 10, voltage: 23 },
    ],
  });
  const upload = async (path, ids) => {
    const body = new FormData();
    body.set(
      'file',
      new File([rawLog], 'test-telemetry.json', { type: 'application/json' }),
    );
    if (ids) body.set('flights', JSON.stringify(ids));
    const response = await fetch('http://127.0.0.1:3000/api/imports/' + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokens.owner },
      body,
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    checks++;
    return result;
  };
  const preview = await upload('preview');
  assert.equal(preview.flights[0].telemetry.length, 2);
  const enrich = {
    targetId: flight.id,
    revision: 1,
    reason: 'Test fixture verified as the same flight for API validation.',
    incoming: preview.flights[0],
  };
  await request('pilot', enrich, 403, 'imports/enrich');
  await request('owner', enrich, 200, 'imports/enrich');
  await request('owner', enrich, 409, 'imports/enrich');
  const archive = await upload('archive', [flight.id]);
  assert.equal(archive.flights[0], flight.id);
  store = await request('owner', null, 200, 'bootstrap', 'GET');
  const enriched = store.records.find((r) => r.id === flight.id);
  assert.equal(enriched.data.durationSeconds, 600);
  assert.equal(enriched.data.telemetry.length, 2);
  assert.equal(enriched.data.aircraftSerial, 'TEST-SN');
  assert.equal(
    store.records.find((r) => r.id === tag + '-A').data.hours,
    usageBeforeEnrichment,
  );
  assert(store.audit.some((a) => a.action === 'flight_telemetry_enriched'));
  const laterFlight = {
    ...flight,
    id: tag + '-F-LATER',
    importHash: tag + '-LATER',
  };
  await request(
    'pilot',
    {
      command: 'flight_import',
      payload: { kind: 'flight', data: laterFlight, revision: 0 },
    },
    200,
    'commands',
  );
  const retriedArchive = await upload('archive', [laterFlight.id]);
  assert.deepEqual(
    new Set(retriedArchive.flights),
    new Set([flight.id, laterFlight.id]),
  );
  const repeatedArchive = await upload('archive', [
    laterFlight.id,
    laterFlight.id,
  ]);
  assert.equal(repeatedArchive.flights.length, 2);
  const second = (
    await request('owner', { action: 'create', name: tag + ' second' })
  ).id;
  orgs.push(second);
  store = await request('owner', null, 200, 'bootstrap', 'GET');
  assert.equal(store.records.length, 0);
  await request(
    'owner',
    { name: 'Stale', logoData: null },
    409,
    'organizations',
    'PATCH',
    { 'X-Aerolog-Organization': first },
  );
  await request('pilot', { action: 'switch', id: second }, 400);
  const list = await request('owner', null, 200, 'organizations', 'GET');
  assert.equal(list.organizations.length, 2);
  await request('owner', { action: 'switch', id: first });
  await request(
    'owner',
    { id: users[1], role: 'pilot', active: false },
    200,
    'accounts',
    'PATCH',
  );
  await request('pilot', { action: 'switch', id: first }, 400);
  await request('pilot', null, 403, 'bootstrap', 'GET');
  await request(
    'owner',
    { id: users[1], role: 'pilot', active: true },
    200,
    'accounts',
    'PATCH',
  );
  await request('pilot', { action: 'switch', id: first });
  const expired = await request('owner', {
    action: 'invite',
    email: tag.toLowerCase() + '-outsider@aerolog.example',
    role: 'observer',
  });
  ok(
    await db
      .from('aerolog_invitations')
      .update({ expires_at: '2000-01-01' })
      .eq(
        'token_hash',
        createHash('sha256').update(expired.code).digest('hex'),
      ),
  );
  await request('outsider', { action: 'join', code: expired.code }, 400);
  console.log(
    'PASS ' +
      checks +
      ' organization API checks: creation, membership, invitation security, branding, tenant isolation, pilot attribution, deduplication, stale-tab protection and access revocation.',
  );
} finally {
  if (orgs.length) {
    const attachments = ok(
      await db
        .from('aerolog_records')
        .select('data')
        .eq('kind', 'attachment')
        .in('organization_id', orgs),
    );
    const paths = attachments.map((a) => a.data.path).filter(Boolean);
    if (paths.length) ok(await db.storage.from('aerolog-files').remove(paths));
  }
  for (const table of [
    'aerolog_audit',
    'aerolog_notifications',
    'aerolog_email_outbox',
    'aerolog_records',
    'aerolog_invitations',
    'aerolog_profiles',
    'aerolog_memberships',
  ])
    if (orgs.length)
      ok(await db.from(table).delete().in('organization_id', orgs));
  for (const id of users) ok(await db.auth.admin.deleteUser(id));
  if (orgs.length)
    ok(await db.from('aerolog_organizations').delete().in('id', orgs));
}
