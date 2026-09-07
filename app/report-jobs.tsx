'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { reportRequestSchema } from '@/lib/reports/flight-report';
export default function ReportJobs({ request }: { request: unknown }) {
  const app = useApp(),
    [jobs, setJobs] = useState<any[]>([]),
    [page, setPage] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const pending = useRef<{ id: string; signature: string } | null>(null);
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await api('reports?page=' + page);
        if (stopped) return;
        setJobs(result.jobs);
        if (
          result.jobs.some((j: any) => ['Queued', 'Running'].includes(j.status))
        )
          timer = setTimeout(() => void load(), 5000);
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    }
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [app.organization.id, page, refresh]);
  async function queue() {
    setBusy(true);
    setError('');
    try {
      const parsed = reportRequestSchema.safeParse(request);
      if (!parsed.success)
        throw Error(parsed.error.issues.map((i) => i.message).join('. '));
      const signature = JSON.stringify(parsed.data);
      if (pending.current?.signature !== signature)
        pending.current = { id: crypto.randomUUID(), signature };
      await api('reports', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          id: pending.current.id,
          request: parsed.data,
        }),
      });
      pending.current = null;
      setPage(0);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="report-jobs">
      <div className="row">
        <div>
          <h2>Saved report exports</h2>
          <p>
            Queue a report using the selected type, entity and dates. Its source
            snapshot stays fixed.
          </p>
        </div>
        <Button disabled={busy} onClick={() => void queue()}>
          {busy ? 'Queuing…' : 'Queue saved export'}
        </Button>
        <Button variant="outline" onClick={() => setRefresh((v) => v + 1)}>
          Refresh jobs
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {jobs.map((job) => (
        <article className="inspection-rule" key={job.id}>
          <div className="row">
            <strong>
              {job.request.type} · {job.request.from} → {job.request.to}
            </strong>
            <span>{job.status}</span>
          </div>
          <p>
            Requested by {job.requested_name} · {job.created_at}
          </p>
          {job.summary && (
            <p>
              {job.summary.entityName} · {job.summary.flightCount} flights ·{' '}
              {(job.summary.durationSeconds / 3600).toFixed(2)} hours
            </p>
          )}
          {job.error && <p role="status">{job.error}</p>}
          {job.status === 'Completed' && (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await api('files/' + job.attachment_id);
                    window.open(r.url, '_blank', 'noopener,noreferrer');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Download saved CSV
              </Button>
              <small title={job.sha256}>
                Content SHA-256: {job.sha256?.slice(0, 16)}… · {job.attempts}{' '}
                generation attempt(s)
              </small>
            </>
          )}
          {['Queued', 'Failed'].includes(job.status) ||
          (job.status === 'Running' &&
            new Date(job.lease_until).getTime() < Date.now()) ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api('reports', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'resume', id: job.id }),
                  });
                  setRefresh((v) => v + 1);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resume generation
            </Button>
          ) : null}
        </article>
      ))}
      {!jobs.length && <p>No saved exports on this page.</p>}
      <div className="row">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Newer exports
        </Button>
        <span>Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={jobs.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Older exports
        </Button>
      </div>
      <p className="fine-print">
        Generation runs on the local app server. Interrupted jobs can be resumed
        after their five-minute processing lease expires.
      </p>
    </section>
  );
}
