import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';
const v = loadEnv(),
  db = createClient(v.NEXT_PUBLIC_SUPABASE_URL, v.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
function check(r) {
  if (r.error) throw Error(r.error.message);
  return r.data;
}
const users = check(await db.auth.admin.listUsers({ perPage: 1000 })).users;
let org = check(
  await db
    .from('aerolog_organizations')
    .select('*')
    .eq('name', 'AEROLOG Local Test')
    .maybeSingle(),
);
if (!org)
  org = check(
    await db
      .from('aerolog_organizations')
      .insert({ name: 'AEROLOG Local Test' })
      .select()
      .single(),
  );
const config = [
  ['admin', v.APP_ADMIN_EMAIL, 'Danijel Jovanovic'],
  ['manager', 'reviewer@aerolog.example', 'Alex Morgan'],
  ['pilot', 'pilot@aerolog.example', 'Sara Ahmed'],
  ['technician', 'technician@aerolog.example', 'Omar Hassan'],
  ['observer', 'observer@aerolog.example', 'Jamie Chen'],
];
let env = fs.readFileSync('.env.local', 'utf8');
function set(k, val) {
  const line = k + '=' + JSON.stringify(val);
  if (new RegExp('^' + k + '=', 'm').test(env))
    env = env.replace(new RegExp('^' + k + '=.*$', 'm'), line);
  else env += '\n' + line;
}
for (const [role, email, name] of config) {
  if (!email) throw Error('APP_ADMIN_EMAIL is missing');
  const prefix = 'LOCAL_TEST_' + role.toUpperCase();
  let user = users.find((u) => u.email === email),
    password = v[prefix + '_PASSWORD'];
  if (!user) {
    password = crypto.randomBytes(24).toString('base64url');
    user = check(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      }),
    ).user;
  } else if (!password) {
    console.log(
      'Existing ' +
        role +
        ' account preserved; use its existing password for sign-in.',
    );
  }
  const profile = check(
    await db
      .from('aerolog_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
  );
  if (profile && profile.organization_id !== org.id)
    throw Error(
      'Existing account belongs to another workspace; not changing it.',
    );
  check(
    await db.from('aerolog_profiles').upsert({
      id: user.id,
      organization_id: org.id,
      display_name: name,
      role,
      active: true,
    }),
  );
  set(prefix + '_EMAIL', email);
  if (password) set(prefix + '_PASSWORD', password);
  const crewId = 'CREW-' + role.toUpperCase();
  const existing = check(
    await db
      .from('aerolog_records')
      .select('id')
      .eq('organization_id', org.id)
      .eq('kind', 'crew')
      .eq('id', crewId)
      .maybeSingle(),
  );
  if (!existing)
    check(
      await db.from('aerolog_records').insert({
        organization_id: org.id,
        kind: 'crew',
        id: crewId,
        created_by: user.id,
        data: {
          id: crewId,
          name,
          initials: name
            .split(' ')
            .map((x) => x[0])
            .join(''),
          role:
            role === 'admin'
              ? 'Operations administrator'
              : role === 'manager'
                ? 'Operations manager'
                : role === 'pilot'
                  ? 'Pilot'
                  : role === 'technician'
                    ? 'Maintenance technician'
                    : 'Visual observer',
          hours: 0,
          flights: 0,
          cert: 'Local test certificate',
          expires: '2027-09-06',
          status: 'Available',
          email,
          authUserId: user.id,
          notes:
            'Local testing fixture. Replace certificate details before operational use.',
        },
      }),
    );
}
const fixtureAssets = [
  {
    id: 'AC–001',
    name: 'Matrice 350 RTK',
    category: 'Aircraft',
    serial: 'LOCAL-M350-001',
    status: 'Available',
    hours: 196,
    pilot: 'Unassigned',
    next: 200,
    intervalHours: 100,
    notes: 'Local test equipment',
  },
  {
    id: 'AC–002',
    name: 'Mavic 3 Thermal',
    category: 'Aircraft',
    serial: 'LOCAL-M3T-002',
    status: 'Available',
    hours: 84,
    pilot: 'Unassigned',
    next: 100,
    intervalHours: 100,
    notes: 'Local test equipment',
  },
  {
    id: 'PL–001',
    name: 'Zenmuse H30T',
    category: 'Payload',
    serial: 'LOCAL-H30T-001',
    status: 'Available',
    hours: 76,
    pilot: 'Unassigned',
    next: 100,
    intervalHours: 100,
    notes: 'Local test equipment',
  },
];
for (const asset of fixtureAssets) {
  const existing = check(
    await db
      .from('aerolog_records')
      .select('id')
      .eq('organization_id', org.id)
      .eq('kind', 'asset')
      .eq('id', asset.id)
      .maybeSingle(),
  );
  if (!existing)
    check(
      await db.from('aerolog_records').insert({
        organization_id: org.id,
        kind: 'asset',
        id: asset.id,
        data: asset,
      }),
    );
}
for (const [id, health, cycles] of [
  ['TB65–001', 96, 84],
  ['TB65–002', 95, 81],
  ['TB65–008', 78, 212],
]) {
  const existing = check(
    await db
      .from('aerolog_records')
      .select('id')
      .eq('organization_id', org.id)
      .eq('kind', 'battery')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!existing)
    check(
      await db.from('aerolog_records').insert({
        organization_id: org.id,
        kind: 'battery',
        id,
        data: {
          id,
          model: 'TB65',
          aircraft: 'Matrice 350 RTK',
          health,
          cycles,
          temp: 38,
          status: health < 80 ? 'Attention required' : 'Healthy',
          notes: 'Local test battery',
        },
      }),
    );
}
set(
  'DJI_PARSER_PYTHON',
  v.DJI_PARSER_PYTHON || process.cwd() + '/.venv/bin/python',
);
set('AEROLOG_LOCAL_TEST_LOGIN', 'true');
fs.writeFileSync('.env.local', env + '\n', { mode: 0o600 });
fs.chmodSync('.env.local', 0o600);
console.log(
  'Local workspace ready. Test accounts and credentials stored in .env.local; passwords not printed. Existing operational records preserved.',
);
