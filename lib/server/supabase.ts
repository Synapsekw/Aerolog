import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Profile } from '../domain/models';
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new ApiError('Supabase server settings are missing.', 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function requireIdentity(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) throw new ApiError('Please sign in.', 401);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user)
    throw new ApiError('Session expired. Please sign in again.', 401);
  return { client, user };
}
export async function requireUser(request: Request) {
  const { client, user } = await requireIdentity(request);
  const { data: profile } = await client
    .from('aerolog_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!profile?.active)
    throw new ApiError('Your account has no active workspace membership.', 403);
  const expected = request.headers.get('x-aerolog-organization');
  if (expected && expected !== profile.organization_id)
    throw new ApiError(
      'The active organization changed. Refresh before saving.',
      409,
    );
  return { client, user, profile: profile as Profile };
}
export function requireRole(profile: Profile, roles: string[]) {
  if (!roles.includes(profile.role))
    throw new ApiError('Your role cannot perform this action.', 403);
}
export function failure(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error && typeof error === 'object' && 'issues' in error)
    return Response.json(
      {
        error: 'Check the form values.',
        details: (error as any).issues.map((i: any) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  console.error(
    'API operation failed:',
    error instanceof Error ? error.name : 'unknown error',
  );
  return Response.json(
    { error: 'Unable to complete the request. Please retry.' },
    { status: 500 },
  );
}
