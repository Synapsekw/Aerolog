import { after } from 'next/server';
import { z } from 'zod';
import {
  requireUser,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
import { reportRequestSchema } from '@/lib/reports/flight-report';
import { processReport } from '@/lib/server/report-worker';
export async function GET(request: Request) {
  try {
    const { client } = await requireUser(request);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(new URL(request.url).searchParams.get('page') || 0);
    const result = await client
      .from('aerolog_report_jobs')
      .select(
        'id,request,status,created_at,requested_name,started_at,completed_at,lease_until,attempts,attachment_id,error,sha256,summary',
      )
      .order('created_at', { ascending: false })
      .order('id')
      .range(page * 25, page * 25 + 24);
    if (result.error) throw new ApiError('Could not load report jobs');
    return Response.json({ jobs: result.data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { profile } = await requireUser(request);
    const input = z
      .discriminatedUnion('action', [
        z.object({
          action: z.literal('create'),
          id: z.uuid(),
          request: reportRequestSchema,
        }),
        z.object({ action: z.literal('resume'), id: z.uuid() }),
      ])
      .parse(await request.json());
    if (input.action === 'create') {
      const result = await adminClient()
        .rpc('aerolog_report_enqueue', {
          actor: profile.id,
          expected_org: profile.organization_id,
          job_id: input.id,
          input: input.request,
        })
        .retry(false);
      if (result.error) throw new ApiError(result.error.message);
    } else {
      const result = await adminClient()
        .from('aerolog_report_jobs')
        .select('id')
        .eq('id', input.id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      if (!result.data) throw new ApiError('Report not found', 404);
    }
    after(() => processReport(profile.id, profile.organization_id, input.id));
    return Response.json({ id: input.id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
