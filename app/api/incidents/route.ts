import { z } from 'zod';
import {
  requireUser,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { incidentSchema } from '@/lib/operations/incidents';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    const { data, revision } = z
      .object({
        data: incidentSchema,
        revision: z.number().int().nonnegative(),
      })
      .parse(await request.json());
    if (new Date(data.occurredAt).getTime() > Date.now() + 60000)
      throw new ApiError('Incident date cannot be in the future');
    const result = await adminClient()
      .rpc('aerolog_incident_write', {
        actor: profile.id,
        expected_org: profile.organization_id,
        document: data,
        expected_revision: revision,
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
    return Response.json(result.data);
  } catch (e) {
    return failure(e);
  }
}
