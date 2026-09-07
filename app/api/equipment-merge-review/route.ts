import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  ApiError,
  failure,
} from '@/lib/server/supabase';
import { equipmentMergeReview } from '@/lib/operations/equipment-merge-review';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const input = z
      .object({
        kind: z.enum(['asset', 'battery']),
        keepId: z.string().min(1).max(100),
        duplicateId: z.string().min(1).max(100),
      })
      .parse(await request.json());
    const result = await adminClient()
      .rpc('aerolog_equipment_merge_preflight', {
        actor: profile.id,
        expected_org: profile.organization_id,
        equipment_kind: input.kind,
        keep_id: input.keepId,
        duplicate_id: input.duplicateId,
      })
      .retry(false);
    if (result.error) throw new ApiError(result.error.message);
    const {
      records,
      reportReferences,
      shareReferences,
      capturedAt,
      reviewDate,
      contextFingerprint,
      aliases,
      inspectionMeterRoutes,
    } = result.data;
    const review = equipmentMergeReview(
      records,
      { kind: input.kind, id: input.keepId },
      { kind: input.kind, id: input.duplicateId },
      aliases,
    );
    const inspectionContext = records.filter((r: any) =>
      [
        'asset',
        'battery',
        'flight',
        'inspection_plan',
        'inspection_event',
      ].includes(r.kind),
    );
    return Response.json(
      {
        ...review,
        inspectionContext,
        contextFingerprint,
        aliases,
        inspectionMeterRoutes,
        reviewDate,
        reportReferences,
        shareReferences,
        capturedAt,
        reviewHash: createHash('sha256')
          .update(JSON.stringify({ review, reportReferences, shareReferences }))
          .digest('hex'),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
