import { createClient } from '@supabase/supabase-js';
export async function POST(request: Request) {
  const url = new URL(request.url),
    origin = request.headers.get('origin');
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.AEROLOG_LOCAL_TEST_LOGIN !== 'true' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    !origin ||
    !['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin) ||
    new URL(origin).host !== request.headers.get('host')
  )
    return Response.json(
      { error: 'Local test login is unavailable.' },
      { status: 403 },
    );
  const { role } = await request.json();
  if (!['admin', 'manager', 'pilot', 'technician', 'observer'].includes(role))
    return Response.json({ error: 'Unknown test role' }, { status: 400 });
  const prefix = 'LOCAL_TEST_' + role.toUpperCase();
  const email = process.env[prefix + '_EMAIL'],
    password = process.env[prefix + '_PASSWORD'];
  if (!email || !password)
    return Response.json(
      { error: 'Run npm run setup:local first.' },
      { status: 503 },
    );
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error)
    return Response.json(
      { error: 'Test account sign-in failed.' },
      { status: 401 },
    );
  return Response.json({ session: data.session });
}
