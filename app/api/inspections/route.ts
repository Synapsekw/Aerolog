import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import {
  inspectionProfileSchema,
  inspectionPlanSchema,
  inspectionEventSchema,
} from '@/lib/operations/inspections';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'technician']);
    const raw = z
      .object({
        kind: z.enum([
          'inspection_profile',
          'inspection_plan',
          'inspection_event',
        ]),
        revision: z.number().int().nonnegative(),
        data: z.unknown(),
      })
      .parse(await request.json());
    const schema = {
      inspection_profile: inspectionProfileSchema,
      inspection_plan: inspectionPlanSchema,
      inspection_event: inspectionEventSchema,
    }[raw.kind];
    const data = schema.parse(raw.data);
    const result = await adminClient()
      .rpc('aerolog_inspection_write', {
        actor: profile.id,
        expected_org: profile.organization_id,
        record_kind: raw.kind,
        document: data,
        expected_revision: raw.revision,
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
