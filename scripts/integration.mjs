import { loadEnv } from './env.mjs';
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const env = loadEnv(),
  base = 'http://127.0.0.1:3000',
  db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  }),
  prefix = 'TEST-' + crypto.randomUUID().slice(0, 8),
  sessions = {},
  clients = {},
  testUsers = [];
let org,
  passed = 0,
  externalOrg,
  externalUser,
  accountUser;
function check(r) {
  if (r.error) throw Error(r.error.message);
  return r.data;
}
async function api(role, path, body, expected = 200, method = 'POST') {
  const r = await fetch(base + '/api/' + path, {
    method: body ? method : 'GET',
    headers: {
      ...(role ? { Authorization: 'Bearer ' + sessions[role] } : {}),
      ...(body && !(body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const out = await r.json();
  assert.equal(
    r.status,
    expected,
    path + ': ' + (out.error || 'unexpected response status'),
  );
  return out;
}
async function command(
  role,
  kind,
  data,
  revision = 0,
  action = 'save',
  note = '',
  status = 200,
) {
  return api(
    role,
    'commands',
    { command: action, payload: { kind, data, revision, note } },
    status,
  );
}
function pass(name) {
  passed++;
  console.log('PASS ' + name);
}
try {
  org = check(await db.from('aerolog_organizations').insert({name:prefix+' integration'}).select().single()).id;
  for (const role of ['admin', 'manager', 'pilot', 'technician', 'observer']) {
    const c = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const email = prefix.toLowerCase() + '-' + role + '@aerolog.example';
    const password = crypto.randomBytes(24).toString('base64url');
    const user = check(await db.auth.admin.createUser({email,password,email_confirm:true})).user;
    testUsers.push(user.id);
    check(await db.from('aerolog_profiles').insert({id:user.id,organization_id:org,display_name:prefix+' '+role,role,active:true}));
    check(await db.from('aerolog_memberships').upsert({organization_id:org,user_id:user.id,display_name:prefix+' '+role,role,active:true}));
    const d = check(await c.auth.signInWithPassword({email,password}));
    sessions[role] = d.session.access_token;
    clients[role] = c;
  }
  const store = await api('admin', 'bootstrap');
  org = store.profile.organization_id;
  await api(null, 'bootstrap', null, 401);
  pass('authentication and all five role sign-ins');
  const local = await fetch(base + '/api/local-login', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'observer' }),
  });
  assert.equal(local.status, 200);
  assert.ok((await local.json()).session.access_token);
  const denied = await fetch(base + '/api/local-login', {
    method: 'POST',
    headers: {
      Origin: 'https://untrusted.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(denied.status, 403);
  pass('development login restricts cross-origin access');

  const aircraft = {
    id: prefix + '-A',
    name: prefix + ' aircraft',
    category: 'Aircraft',
    serial: prefix + '-serial',
    status: 'Available',
    hours: 10,
    next: 20,
    intervalHours: 50,
    pilot: 'Unassigned',
    notes: '',
  };
  await command('observer', 'asset', aircraft, 0, 'save', '', 403);
  await command('pilot', 'asset', aircraft, 0, 'save', '', 403);
  await command('technician', 'asset', aircraft);
  pass('role restrictions and technician inventory creation');
  let raw = await clients.pilot.from('aerolog_records').insert({
    organization_id: org,
    kind: 'asset',
    id: prefix + '-bad',
    data: aircraft,
  });
  assert.ok(raw.error);
  pass('direct table writes blocked');
  const pilot = {
      id: prefix + '-P',
      name: prefix + ' pilot',
      initials: 'TP',
      role: 'Pilot',
      aircraftPermission: 'All aircraft',
      cert: 'Test',
      expires: '2035-01-01',
      status: 'Available',
      hours: 0,
      flights: 0,
      notes: '',
    },
    observer = { ...pilot, id: prefix + '-O', name: prefix + ' observer' };
  await command('admin', 'crew', pilot);
  await command('admin', 'crew', observer);
  const battery = {
    id: prefix + '-B',
    model: 'Test',
    aircraft: aircraft.name,
    cycles: 10,
    health: 95,
    temp: 30,
    status: 'Healthy',
    notes: '',
  };
  await command('technician', 'battery', battery);
  const mission = {
    id: prefix + '-M',
    name: prefix + ' mission',
    location: 'Dubai test site',
    date: '2030-01-01',
    time: '23:30',
    durationMinutes: 90,
    type: 'Survey',
    status: 'Draft',
    pilot: pilot.name,
    observer: observer.name,
    aircraft: aircraft.name,
    equipment: [battery.id],
    notes: 'Integration test',
    risks: [
      {
        hazard: 'People nearby',
        likelihood: 2,
        severity: 3,
        mitigation: 'Controlled perimeter',
        controlled: true,
        residualLikelihood: 1,
        residualSeverity: 2,
      },
    ],
    geometry: [
      [55.2, 25.1],
      [55.21, 25.1],
      [55.21, 25.11],
    ],
    altitude: 60,
    history: [],
  };
  let m = await command('admin', 'mission', mission);
  await command(
    'admin',
    'mission',
    { ...mission, status: 'Pending approval', risks: [] },
    m.revision,
    'save',
    '',
    400,
  );
  pass('incomplete risk assessment blocked');
  const file = new FormData();
  file.set('mission', mission.id);
  file.set(
    'file',
    new File(['Test mission document'], 'checklist.txt', {
      type: 'text/plain',
    }),
  );
  const attachment = await api('admin', 'files', file);
  const signed = await api('observer', 'files/' + attachment.id);
  assert.ok(signed.url);
  pass('private attachment upload and authorized signed download');
  m = await command(
    'admin',
    'mission',
    { ...mission, status: 'Pending approval' },
    m.revision,
  );
  await command(
    'admin',
    'mission',
    { ...m.data, status: 'Approved' },
    m.revision,
    'review',
    '',
    400,
  );
  await command(
    'pilot',
    'mission',
    { ...m.data, status: 'Approved' },
    m.revision,
    'review',
    '',
    403,
  );
  pass('independent manager review enforced');
  await api('admin', 'files', file, 400);
  pass('attachments locked on submission');
  await command(
    'admin',
    'mission',
    {
      ...mission,
      id: prefix + '-overlap',
      date: '2030-01-02',
      time: '00:00',
      status: 'Pending approval',
    },
    0,
    'save',
    '',
    400,
  );
  pass('overnight crew and aircraft conflict detected');
  m = await command(
    'manager',
    'mission',
    { ...m.data, status: 'Approved' },
    m.revision,
    'review',
    'Reviewed',
  );
  await command(
    'admin',
    'mission',
    { ...m.data, name: 'tampered' },
    m.revision,
    'save',
    '',
    400,
  );
  await command('manager', 'mission', m.data, 1, 'review', '', 409);
  pass('approval locks and optimistic concurrency');
  const pdf = await fetch(base + '/api/missions/' + mission.id + '/pdf', {
    headers: { Authorization: 'Bearer ' + sessions.manager },
  });
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
  pass('mission package PDF generated');
  m = await command(
    'admin',
    'mission',
    m.data,
    m.revision,
    'mission_complete',
    'Safe completion',
  );
  assert.equal(m.data.status, 'Completed');
  pass('mission debrief and completion');
  const flight = {
    id: prefix + '-F',
    mission: mission.name,
    missionId: mission.id,
    pilot: pilot.name,
    aircraft: aircraft.name,
    date: '2026-09-06',
    duration: '10:00',
    durationSeconds: 600,
    distance: '2.5',
    altitude: 60,
    start: 95,
    end: 50,
    battery: battery.id,
    peakTemperature: 41,
    source: 'CSV',
    importHash: prefix + '-hash',
    notes: '',
    telemetry: [],
  };
  await command('admin', 'flight', flight, 0, 'flight_import');
  await command(
    'admin',
    'flight',
    { ...flight, id: prefix + '-dup' },
    0,
    'flight_import',
    '',
    400,
  );
  let assetRow = check(
    await db
      .from('aerolog_records')
      .select('*')
      .eq('organization_id', org)
      .eq('kind', 'asset')
      .eq('id', aircraft.id)
      .single(),
  );
  assert.equal(assetRow.data.hours, 10.167);
  pass('flight import increments usage once, duplicates roll back');
  raw = await clients.admin.rpc('aerolog_command', {
    command: 'flight_import',
    payload: {
      kind: 'flight',
      data: {
        ...flight,
        id: prefix + '-negative',
        durationSeconds: -600,
        importHash: prefix + '-neg',
      },
      revision: 0,
    },
  });
  assert.ok(raw.error);
  pass('database rejects negative usage through direct RPC');
  raw = await clients.admin.rpc('aerolog_command', {
    command: 'save',
    payload: {
      kind: 'attachment',
      data: { id: prefix + '-fake', path: 'other-org/stolen' },
      revision: 0,
    },
  });
  assert.ok(raw.error);
  pass('arbitrary storage metadata injection blocked');
  let b = await command(
    'technician',
    'battery',
    { ...battery, status: 'Quarantined' },
    1,
  );
  b = await command(
    'technician',
    'battery',
    { ...b.data, health: 99, temp: 25 },
    b.revision,
    'battery_cycle',
    'Measured',
  );
  assert.equal(b.data.cycles, 11);
  assert.equal(b.data.status, 'Quarantined');
  pass('cycle histories preserve quarantine');
  const service = {
    id: prefix + '-S',
    asset: aircraft.name,
    task: 'Scheduled inspection',
    due: '2026-09-06',
    remaining: 0,
    status: 'Scheduled',
    technician: 'Omar Hassan',
    notes: '',
    intervalHours: 50,
  };
  let s = await command('technician', 'service', service);
  s = await command(
    'technician',
    'service',
    s.data,
    s.revision,
    'service_complete',
    'Inspection passed',
  );
  await command(
    'technician',
    'service',
    s.data,
    s.revision,
    'service_complete',
    'Again',
    400,
  );
  assetRow = check(
    await db
      .from('aerolog_records')
      .select('*')
      .eq('organization_id', org)
      .eq('kind', 'asset')
      .eq('id', aircraft.id)
      .single(),
  );
  assert.equal(assetRow.data.next, 60.167);
  pass('maintenance sign-off advances interval once');
  const csv = new FormData();
  csv.set(
    'file',
    new File(
      ['date,durationSeconds,distanceKm\n2026-09-06,600,2.5'],
      'test.csv',
      { type: 'text/csv' },
    ),
  );
  const preview = await api('admin', 'imports/preview', csv);
  assert.equal(preview.flights[0].distance, '2.5');
  await api('observer', 'imports/preview', csv, 403);
  pass('authenticated import preview and read-only restrictions');
  const invalidDji = new FormData();
  invalidDji.set(
    'file',
    new File(['invalid binary'], 'bad.txt', { type: 'text/plain' }),
  );
  await api('admin', 'imports/preview', invalidDji, 400);
  pass('malformed DJI records fail safely');

  const source = new FormData();
  source.set(
    'file',
    new File(['integration source ' + prefix], 'original.txt', {
      type: 'text/plain',
    }),
  );
  source.set('flights', JSON.stringify([flight.id]));
  const archived = await api('admin', 'imports/archive', source);
  const sourceUrl = await api('observer', 'files/' + archived.id);
  const original = await fetch(sourceUrl.url);
  assert.equal(await original.text(), 'integration source ' + prefix);
  pass('original flight sources privately archived and downloadable');

  externalOrg = check(
    await db
      .from('aerolog_organizations')
      .insert({ name: prefix + ' isolation' })
      .select()
      .single(),
  ).id;
  const password = crypto.randomBytes(24).toString('base64url'),
    email = prefix.toLowerCase() + '@aerolog.example';
  externalUser = check(
    await db.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user.id;
  check(
    await db.from('aerolog_profiles').insert({
      id: externalUser,
      organization_id: externalOrg,
      display_name: 'Isolation test',
      role: 'admin',
    }),
  );
  const outsider = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  sessions.outsider = check(
    await outsider.auth.signInWithPassword({ email, password }),
  ).session.access_token;
  const outside = await api('outsider', 'bootstrap');
  assert.equal(outside.records.length, 0);
  await api('outsider', 'files/' + attachment.id, null, 404);
  pass('cross-workspace records and attachments isolated');
  const guestEmail = prefix.toLowerCase() + '-member@aerolog.example';
  await api(
    'pilot',
    'accounts',
    { name: prefix + ' member', email: guestEmail, role: 'observer' },
    403,
  );
  const guest = await api('admin', 'accounts', {
    name: prefix + ' member',
    email: guestEmail,
    role: 'observer',
  });
  accountUser = guest.id;
  const member = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  sessions.member = check(
    await member.auth.signInWithPassword({
      email: guestEmail,
      password: guest.temporaryPassword,
    }),
  ).session.access_token;
  assert.equal((await api('member', 'bootstrap')).profile.role, 'observer');
  pass('administrator account provisioning and role assignment');
  await api(
    'member',
    'accounts',
    { id: guest.id, role: 'admin', active: true },
    403,
    'PATCH',
  );
  await api(
    'admin',
    'accounts',
    { id: guest.id, role: 'pilot', active: false },
    200,
    'PATCH',
  );
  await api('member', 'bootstrap', null, 403);
  pass('access management blocks self-elevation and revokes membership');
  console.log('\n' + passed + ' integration checks passed.');
} finally {
  if (org) {
    const files = check(
      await db
        .from('aerolog_records')
        .select('id,data')
        .eq('organization_id', org)
        .eq('kind', 'attachment'),
    ).filter(
      (x) =>
        x.data.mission?.startsWith(prefix) ||
        x.data.flights?.some((id) => id.startsWith(prefix)),
    );
    if (files.length) {
      await db
        .from('aerolog_audit')
        .delete()
        .eq('organization_id', org)
        .in(
          'record_id',
          files.map((x) => x.id),
        );
      await db.storage
        .from('aerolog-files')
        .remove(files.map((x) => x.data.path));
      await db
        .from('aerolog_records')
        .delete()
        .eq('organization_id', org)
        .in(
          'id',
          files.map((x) => x.id),
        );
    }
    await db
      .from('aerolog_records')
      .delete()
      .eq('organization_id', org)
      .eq('kind', 'battery_event')
      .like('data->>battery', prefix + '%');
    await db
      .from('aerolog_records')
      .delete()
      .eq('organization_id', org)
      .like('id', prefix + '%');
    await db
      .from('aerolog_audit')
      .delete()
      .eq('organization_id', org)
      .like('record_id', prefix + '%');
    await db
      .from('aerolog_notifications')
      .delete()
      .eq('organization_id', org)
      .like('record_id', prefix + '%');
  }
  if (accountUser) {
    await db
      .from('aerolog_audit')
      .delete()
      .eq('organization_id', org)
      .eq('record_id', accountUser);
    await db.auth.admin.deleteUser(accountUser);
  }
  if (externalUser) await db.auth.admin.deleteUser(externalUser);
  if (externalOrg)
    await db.from('aerolog_organizations').delete().eq('id', externalOrg);
  if (org) {
    for (const table of ['aerolog_report_jobs','aerolog_email_outbox','aerolog_audit','aerolog_notifications','aerolog_records','aerolog_invitations','aerolog_profiles','aerolog_memberships'])
      check(await db.from(table).delete().eq('organization_id',org));
  }
  for (const id of testUsers) check(await db.auth.admin.deleteUser(id));
  if(org) check(await db.from('aerolog_organizations').delete().eq('id',org));
  console.log('Temporary test records and isolated organization cleaned up.');
}
