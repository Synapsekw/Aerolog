import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  ApiError,
  failure,
} from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get('page') || 0);
    const result = await adminClient()
      .rpc('aerolog_equipment_share_list', {
        actor: profile.id,
        expected_org: profile.organization_id,
        page,
      })
      .retry(false);
    if (result.error) throw new ApiError(result.error.message);
    return Response.json({
      shares: result.data.slice(0, 25),
      hasMore: result.data.length > 25,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const input = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          kind: z.enum(['asset', 'battery']),
          equipmentId: z.string().min(1).max(100),
          recipientOrg: z.uuid(),
          expiresAt: z.iso.datetime(),
        }),
        z.object({
          action: z.enum(['accept', 'decline', 'revoke', 'end']),
          id: z.uuid(),
        }),
      ])
      .parse(await request.json());
    const result = await adminClient()
      .rpc('aerolog_equipment_share', {
        actor: profile.id,
        expected_org: profile.organization_id,
        action: input.action,
        document:
          input.action === 'create' ? { ...input, id: randomUUID() } : input,
      })
      .retry(false);
    if (result.error) throw new ApiError(result.error.message);
    return Response.json(result.data);
  } catch (e) {
    return failure(e);
  }
}
