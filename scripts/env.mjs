import fs from 'node:fs';
import { parseEnv } from 'node:util';
export function loadEnv() {
  const file = '.env.local';
  const values = fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8'))
    : {};
  for (const [k, v] of Object.entries(values))
    if (!process.env[k]) process.env[k] = v;
  return values;
}
export function redact(text, values) {
  let s = String(text);
  for (const [k, v] of Object.entries(values))
    if (v && /(KEY|TOKEN|PASSWORD|SECRET)/.test(k))
      s = s.replaceAll(v, '[REDACTED]');
  return s;
}
