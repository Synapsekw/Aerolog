import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { formTemplateSchema } from '@/lib/operations/forms';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const raw = z
      .object({
        data: formTemplateSchema,
        revision: z.number().int().nonnegative(),
      })
      .parse(await request.json());
    const result = await adminClient()
      .rpc('aerolog_form_template_write', {
        actor: profile.id,
        expected_org: profile.organization_id,
        document: raw.data,
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
