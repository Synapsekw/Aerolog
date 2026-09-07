import 'server-only';
import { createHash } from 'node:crypto';
import { reportPdf } from '@/lib/reports/report-pdf';
import { adminClient } from './supabase';
import {
  createFlightReport,
  reportCsv,
  reportRequestSchema,
} from '@/lib/reports/flight-report';
export async function processReport(
  actor: string,
  organization: string,
  id: string,
) {
  const admin = adminClient();
  const claimed = await admin
    .rpc('aerolog_report_claim', {
      actor,
      expected_org: organization,
      job_id: id,
    })
    .retry(false);
  if (claimed.error || !claimed.data) return;
  const job = claimed.data;
  try {
    if (job.snapshot.version !== 1)
      throw Error('Unsupported report snapshot version');
    const report = createFlightReport(
      reportRequestSchema.parse(job.request),
      job.snapshot.records,
      job.snapshot.members,
    );
    const isPdf = job.request.format === 'PDF';
    const bytes = isPdf
      ? Buffer.from(await reportPdf(report, job.snapshot.organization, job.created_at))
      : Buffer.from(reportCsv(report, job.snapshot.organization, job.created_at), 'utf8');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const extension = isPdf ? 'pdf' : 'csv';
    const mime = isPdf ? 'application/pdf' : 'text/csv';
    const path = `${organization}/reports/${id}/${job.lease_token}.${extension}`;
    const uploaded = await admin.storage
      .from('aerolog-files')
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
      });
    if (uploaded.error) throw Error('Report file upload failed');
    const result = await admin
      .rpc('aerolog_report_finish', {
        job_id: id,
        token: job.lease_token,
        artifact: {
          id,
          path,
          name: `aerolog-${report.request.type.toLowerCase()}-${report.request.from}-${report.request.to}.${extension}`,
          size: bytes.length,
          type: mime,
        },
        result_summary: {
          flightCount: report.flightCount,
          durationSeconds: report.durationSeconds,
          distanceKm: report.distanceKm,
          undatedExcluded: report.undatedExcluded,
          entityName: report.entityName,
          calculationVersion: report.version,
        },
        content_hash: sha256,
        failure: null,
      })
      .retry(false);
    if (result.error) throw Error('Report completion could not be recorded');
    if (result.data === false)
      await admin.storage.from('aerolog-files').remove([path]);
  } catch (error) {
    await admin
      .rpc('aerolog_report_finish', {
        job_id: id,
        token: job.lease_token,
        artifact: null,
        result_summary: null,
        content_hash: null,
        failure: (error as Error).message,
      })
      .retry(false);
  }
}
