import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { catalogSchemas } from '@/lib/operations/catalog';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager']);
    const raw = z
      .object({
        kind: z.enum(['customer', 'project', 'site']),
        revision: z.number().int().nonnegative(),
        data: z.unknown(),
      })
      .parse(await request.json());
    const doc = catalogSchemas[raw.kind].parse(raw.data);
    const result = await adminClient()
      .rpc('aerolog_catalog_write', {
        actor: profile.id,
        expected_org: profile.organization_id,
        record_kind: raw.kind,
        document: doc,
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
