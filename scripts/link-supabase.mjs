import { spawnSync } from 'node:child_process';
import { loadEnv, redact } from './env.mjs';
const v = loadEnv();
if (!/^[a-z0-9]{20}$/.test(v.SUPABASE_PROJECT_ID || ''))
  throw Error('Invalid Supabase reference');
const r = spawnSync(
  'supabase',
  ['link', '--project-ref', v.SUPABASE_PROJECT_ID],
  {
    encoding: 'utf8',
    env: { ...process.env, SUPABASE_DB_PASSWORD: v.SUPABASE_DB_PASSWORD },
    timeout: 60000,
  },
);
console.log(redact((r.stdout || '') + (r.stderr || ''), v));
process.exitCode = r.status ?? 1;
