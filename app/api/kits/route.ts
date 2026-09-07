import { z } from 'zod';
import {
  requireUser,
  requireRole,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { kitSchema } from '@/lib/operations/kits';
export async function POST(request: Request) {
  try {
    const { client, profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'technician']);
    const { data, revision } = z
      .object({ data: kitSchema, revision: z.number().int().min(0) })
      .parse(await request.json());
    const result = await client
      .rpc('aerolog_save_kit', {
        document: data,
        expected_revision: revision,
        expected_organization: profile.organization_id,
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
