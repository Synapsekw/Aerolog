import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin']);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.email(),
        role: z.enum(['admin', 'manager', 'pilot', 'technician', 'observer']),
      })
      .parse(await request.json());
    const password = randomBytes(20).toString('base64url');
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: input.name },
    });
    if (error) throw new ApiError(error.message);
    const id = data.user.id;
    const { error: profileError } = await admin
      .from('aerolog_profiles')
      .insert({
        id,
        organization_id: profile.organization_id,
        display_name: input.name,
        role: input.role,
      });
    if (profileError) {
      await admin.auth.admin.deleteUser(id);
      throw new ApiError(
        'Could not create workspace membership. No account was retained.',
      );
    }
    await admin.from('aerolog_audit').insert({
      organization_id: profile.organization_id,
      actor_id: profile.id,
      actor_name: profile.display_name,
      action: 'account_created',
      kind: 'profile',
      record_id: id,
      after_data: { display_name: input.name, role: input.role },
    });
    return Response.json({ id, temporaryPassword: password });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { client, profile } = await requireUser(request);
    requireRole(profile, ['admin']);
    const input = z
      .object({
        id: z.uuid(),
        role: z.enum(['admin', 'manager', 'pilot', 'technician', 'observer']),
        active: z.boolean(),
      })
      .parse(await request.json());
    const { error } = await client
      .rpc('aerolog_access', {
        target: input.id,
        new_role: input.role,
        enabled: input.active,
      })
      .retry(false);
    if (error) throw new ApiError(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
