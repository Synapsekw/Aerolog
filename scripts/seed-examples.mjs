import { loadEnv } from './env.mjs';
import { createClient } from '@supabase/supabase-js';
const env = loadEnv(),
  client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
const { data, error } = await client.auth.signInWithPassword({
  email: env.LOCAL_TEST_ADMIN_EMAIL,
  password: env.LOCAL_TEST_ADMIN_PASSWORD,
});
if (error) throw Error('Test administrator sign-in failed');
const headers = {
  Authorization: 'Bearer ' + data.session.access_token,
  'Content-Type': 'application/json',
};
const base = 'http://127.0.0.1:3000/api/';
const store = await (await fetch(base + 'bootstrap', { headers })).json();
if (store.organization?.name !== 'AEROLOG Local Test')
  throw Error('Examples are restricted to the local test workspace');
const existing = new Set(store.records.map((r) => r.id));
const date = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function save(kind, record, command = 'save') {
  if (existing.has(record.id)) return;
  const r = await fetch(base + 'commands', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      command,
      payload: { kind, data: record, revision: 0 },
    }),
  });
  if (!r.ok) throw Error((await r.json()).error);
  existing.add(record.id);
}
for (let day = 0; day < 7; day++) {
  const seconds = 480 + day * 53,
    telemetry = Array.from({ length: 100 }, (_, i) => ({
      time: Math.round((i * seconds) / 99),
      longitude: 55.139 + Math.sin((i / 99) * Math.PI * 4) * 0.002,
      latitude: 25.078 + i * 0.00006,
      altitude: Math.min(i * 5, 60, (99 - i) * 5),
      battery: Math.round(98 - i * 0.42),
      temperature: 28 + i * 0.08,
      voltage: 50.2 - i * 0.023,
      speed: i === 0 || i === 99 ? 0 : 4.5,
    }));
  await save(
    'flight',
    {
      id: 'SAMPLE-FLIGHT-' + day,
      mission: 'LOCAL SAMPLE · Thermal training ' + (day + 1),
      pilot: 'Sara Ahmed',
      aircraft: 'Matrice 350 RTK',
      date: date(-day),
      duration:
        Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0'),
      durationSeconds: seconds,
      distance: (1.8 + day * 0.15).toFixed(2),
      altitude: 60,
      start: 98,
      end: 56,
      battery: 'TB65–001',
      peakTemperature: 36,
      source: 'Manual',
      importHash: 'aerolog-local-synthetic-v1-' + day,
      telemetry,
      notes:
        'SYNTHETIC LOCAL TEST FIXTURE. The positions, battery measurements and flight values were generated to preview the UI and are not actual flights.',
    },
    'flight_import',
  );
}
await save('mission', {
  id: 'SAMPLE-MISSION-REVIEW',
  name: 'LOCAL SAMPLE · Solar inspection',
  location: 'Dubai test site',
  date: date(1),
  time: '06:30',
  durationMinutes: 60,
  type: 'Inspection',
  status: 'Pending approval',
  pilot: 'Sara Ahmed',
  observer: 'Jamie Chen',
  aircraft: 'Matrice 350 RTK',
  equipment: ['TB65–001', 'Zenmuse H30T'],
  notes:
    'SYNTHETIC LOCAL TEST FIXTURE. Use the manager test account to review this package. Replace all planning details before any real operation.',
  risks: [
    {
      hazard: 'People entering the operating area',
      likelihood: 3,
      severity: 4,
      mitigation:
        'Sample control: designated observer and marked ground perimeter.',
      controlled: true,
      residualLikelihood: 1,
      residualSeverity: 4,
    },
  ],
  geometry: [
    [55.135, 25.074],
    [55.144, 25.074],
    [55.144, 25.085],
    [55.135, 25.085],
  ],
  altitude: 60,
  history: [],
});
await save('service', {
  id: 'SAMPLE-SERVICE-INSPECTION',
  asset: 'Matrice 350 RTK',
  task: 'LOCAL SAMPLE · Airframe and propeller inspection',
  due: date(1),
  remaining: 2,
  status: 'Scheduled',
  technician: 'Omar Hassan',
  intervalHours: 100,
  notes:
    'SYNTHETIC LOCAL TEST FIXTURE. Practice inspection sign-off using the technician account.',
});
console.log(
  'Clearly labeled local sample flights, telemetry, review package and work order are ready. Existing records preserved.',
);
