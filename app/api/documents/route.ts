import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { documentSchema } from '@/lib/operations/documents';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const input = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('save'),
          data: documentSchema,
          revision: z.number().int().nonnegative(),
          submit: z.boolean(),
        }),
        z.object({
          action: z.literal('review'),
          id: z.string().min(1).max(100),
          revision: z.number().int().positive(),
          decision: z.enum(['Approved', 'Rejected']),
          note: z.string().trim().min(5).max(4000),
        }),
      ])
      .parse(await request.json());
    const result = await adminClient()
      .rpc('aerolog_document_write', {
        actor: profile.id,
        expected_org: profile.organization_id,
        request: input,
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
