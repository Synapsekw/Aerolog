import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  ApiError,
  failure,
} from '@/lib/server/supabase';
import { flightSchema } from '@/lib/domain/models';
import { enrichmentPatch } from '@/lib/flight/enrichment';
export async function POST(request: Request) {
  try {
    const { client, profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const input = z
      .object({
        targetId: z.string().min(1).max(100),
        revision: z.number().int().positive(),
        reason: z.string().trim().min(20).max(2000),
        incoming: flightSchema,
      })
      .parse(await request.json());
    if (!input.incoming.importHash)
      throw new ApiError('A source hash is required.');
    const { data: target, error } = await client
      .from('aerolog_records')
      .select('data,revision')
      .eq('kind', 'flight')
      .eq('id', input.targetId)
      .single();
    if (error || !target) throw new ApiError('Flight not found', 404);
    let patch;
    try {
      patch = enrichmentPatch(target.data, input.incoming);
    } catch (e) {
      throw new ApiError((e as Error).message);
    }
    const result = await adminClient()
      .rpc('aerolog_enrich_flight', {
        actor: profile.id,
        expected_org: profile.organization_id,
        target_id: input.targetId,
        expected_revision: input.revision,
        patch,
        source_hash: input.incoming.importHash,
        reason: input.reason,
      })
      .retry(false);
    if (result.error)
      throw new ApiError(
        result.error.message,
        result.error.code === 'PT409' ? 409 : 400,
      );
    return Response.json(result.data);
  } catch (e) {
    return failure(e);
  }
}
