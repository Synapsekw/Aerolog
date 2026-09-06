import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  requireIdentity,
  requireUser,
  requireRole,
  adminClient,
  ApiError,
  failure,
} from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    const { client, user } = await requireIdentity(request);
    const { data: memberships, error } = await client
      .from('aerolog_memberships')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true);
    if (error) throw error;
    const ids = memberships.map((m) => m.organization_id);
    const { data, error: orgError } = ids.length
      ? await adminClient()
          .from('aerolog_organizations')
          .select('id,name,logo_data')
          .in('id', ids)
      : { data: [], error: null };
    if (orgError) throw orgError;
    return Response.json({ organizations: data, email: user.email });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireIdentity(request);
    const input = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          name: z.string().trim().min(1).max(100),
          displayName: z.string().trim().min(1).max(100).optional(),
        }),
        z.object({ action: z.literal('switch'), id: z.uuid() }),
        z.object({
          action: z.literal('join'),
          code: z.string().min(32).max(128),
          displayName: z.string().trim().min(1).max(100).optional(),
        }),
        z.object({
          action: z.literal('invite'),
          email: z.email(),
          role: z.enum(['admin', 'manager', 'pilot', 'technician', 'observer']),
        }),
      ])
      .parse(await request.json());
    if (input.action === 'invite') {
      const { profile } = await requireUser(request);
      requireRole(profile, ['admin']);
      const code = randomBytes(32).toString('base64url');
      const { error } = await adminClient()
        .from('aerolog_invitations')
        .insert({
          organization_id: profile.organization_id,
          email: input.email.toLowerCase(),
          role: input.role,
          token_hash: createHash('sha256').update(code).digest('hex'),
        });
      if (error) throw error;
      return Response.json({ code });
    }
    const payload =
      input.action === 'join'
        ? {
            displayName: input.displayName,
            tokenHash: createHash('sha256').update(input.code).digest('hex'),
          }
        : input;
    const { data, error } = await client
      .rpc('aerolog_organization', { action: input.action, payload })
      .retry(false);
    if (error)
      throw new ApiError(
        error.code === '23505'
          ? 'A member already uses that name in this organization. Add an initial or another distinguishing detail.'
          : error.message,
      );
    return Response.json({ id: data });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin']);
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        logoData: z.string().max(280000).nullable(),
      })
      .parse(await request.json());
    if (input.logoData) {
      const match =
        /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(
          input.logoData,
        );
      if (!match) throw new ApiError('Upload a PNG, JPEG or WebP logo.');
      const b = Buffer.from(match[2], 'base64');
      const valid =
        match[1] === 'png'
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : match[1] === 'jpeg'
            ? b[0] === 255 && b[1] === 216 && b[2] === 255
            : b.toString('ascii', 0, 4) === 'RIFF' &&
              b.toString('ascii', 8, 12) === 'WEBP';
      if (!valid || b.length > 200000)
        throw new ApiError('Use a valid image smaller than 200 KB.');
    }
    const { error } = await adminClient()
      .from('aerolog_organizations')
      .update({ name: input.name, logo_data: input.logoData })
      .eq('id', profile.organization_id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
