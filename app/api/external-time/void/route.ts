import { z } from 'zod';
import {
  requireUser,
  requireRole,
  failure,
  ApiError,
} from '@/lib/server/supabase';
export async function POST(request: Request) {
  try {
    const { client, profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const data = z
      .object({
        crewId: z.string().min(1).max(100),
        entryId: z.string().min(1).max(100),
        reason: z.string().trim().min(10).max(4000),
        revision: z.number().int().positive(),
      })
      .parse(await request.json());
    const result = await client
      .rpc('aerolog_external_time_void', {
        expected_org: profile.organization_id,
        crew_id: data.crewId,
        entry_id: data.entryId,
        reason: data.reason,
        expected_revision: data.revision,
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
