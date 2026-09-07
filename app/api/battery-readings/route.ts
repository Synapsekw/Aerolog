import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { batteryReadingRecordSchema } from '@/lib/battery/readings';
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'technician']);
    const data = batteryReadingRecordSchema.parse(await request.json());
    if (Date.parse(data.measuredAt) > Date.now())
      throw new ApiError('Measurement time cannot be in the future');
    const result = await adminClient()
      .rpc('aerolog_battery_reading', {
        actor: profile.id,
        expected_org: profile.organization_id,
        document: data,
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
