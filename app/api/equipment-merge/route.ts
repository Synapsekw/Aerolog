import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  ApiError,
  failure,
} from '@/lib/server/supabase';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const { operationId, ...input } = z
      .object({
        operationId: z.uuid(),
        kind: z.enum(['asset', 'battery']),
        keepId: z.string().min(1).max(100),
        duplicateId: z.string().min(1).max(100),
        contextFingerprint: z.string().regex(/^[a-f0-9]{32}$/),
        counterSource: z.enum(['keep', 'duplicate']),
        reason: z.string().trim().min(10).max(1000),
        physicalIdentityConfirmed: z.literal(true),
      })
      .strict()
      .parse(await request.json());
    const result = await adminClient()
      .rpc('aerolog_equipment_merge_apply', {
        actor: profile.id,
        expected_org: profile.organization_id,
        operation_id: operationId,
        input,
      })
      .retry(false);
    if (result.error)
      throw new ApiError(
        result.error.message,
        result.error.code === 'PT409'
          ? 409
          : result.error.code === '42501'
            ? 403
            : 400,
      );
    return Response.json(result.data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const id = z.uuid().parse(new URL(request.url).searchParams.get('id'));
    const result = await adminClient()
      .from('aerolog_equipment_merges')
      .select('receipt')
      .eq('organization_id', profile.organization_id)
      .eq('id', id)
      .maybeSingle();
    if (result.error) throw new ApiError(result.error.message);
    if (!result.data) throw new ApiError('Merge receipt not found', 404);
    return Response.json(result.data.receipt, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
