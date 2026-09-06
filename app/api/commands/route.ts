import { z } from 'zod';
import { requireUser, failure, ApiError } from '@/lib/server/supabase';
import { schemas, type Kind } from '@/lib/domain/models';
export async function POST(request: Request) {
  try {
    const { client } = await requireUser(request);
    const raw = await request.json();
    const command = z
      .enum([
        'save',
        'review',
        'mission_complete',
        'service_complete',
        'battery_cycle',
        'flight_import',
        'notification_read',
        'settings',
      ])
      .parse(raw.command);
    let payload: any;
    if (command === 'notification_read')
      payload = z.object({ id: z.uuid() }).parse(raw.payload);
    else if (command === 'settings')
      payload = z
        .object({
          timezone: z.string().min(1).max(80),
          batteryMinHealth: z.number().min(0).max(100),
          batteryMaxTemperature: z.number().min(20).max(100),
          allowSelfApproval: z.boolean(),
        })
        .parse(raw.payload);
    else {
      const base = z
        .object({
          kind: z.enum([
            'mission',
            'asset',
            'battery',
            'crew',
            'service',
            'flight',
          ]),
          data: z.unknown(),
          revision: z.number().int().min(0),
          note: z.string().max(12000).optional(),
        })
        .parse(raw.payload);
      payload = { ...base, data: schemas[base.kind as Kind].parse(base.data) };
    }
    const { data, error } = await client
      .rpc('aerolog_command', {
        command,
        payload,
      })
      .retry(false);
    if (error)
      throw new ApiError(
        error.code === '23505'
          ? 'This serial number, name, or imported flight already exists.'
          : error.message,
        error.code === '42501'
          ? 403
          : ['40001', 'PT409'].includes(error.code)
            ? 409
            : 400,
      );
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
