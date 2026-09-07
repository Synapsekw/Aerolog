'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import ReportJobs from './report-jobs';
import ReportHistory from './report-history';
import OrganizationCostReport from './organization-cost-report';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  createFlightReport,
  reportRequestSchema,
  reportCsv,
  type FlightReport,
  type ReportRecord,
} from '@/lib/reports/flight-report';
export default function ReportCenter() {
  const app = useApp(),
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: app.organization.settings?.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const [type, setType] = useState('Organization'),
    [entityId, setEntityId] = useState(''),
    [includeHistory, setIncludeHistory] = useState(false),
    [format, setFormat] = useState('CSV'),
    [from, setFrom] = useState(today.slice(0, 4) + '-01-01'),
    [to, setTo] = useState(today),
    [report, setReport] = useState<FlightReport | null>(null),
    [error, setError] = useState(''),
    [page, setPage] = useState(0),
    [generatedAt, setGeneratedAt] = useState('');
  const entities =
    type === 'Pilot'
      ? app.profiles.map((p) => ({ id: p.id, name: p.display_name }))
      : type === 'Aircraft'
        ? app
            .items('asset')
            .filter((a) => a.category === 'Aircraft')
            .map((a) => ({ id: a.id, name: a.name }))
        : app.items('battery').map((b) => ({
            id: b.id,
            name: (b.sourceName || b.model) + ' · ' + (b.serial || b.id),
          }));
  return (
    <section className="glass operations-catalog report-center">
      <OrganizationCostReport />
      <div className="form-grid">
        <label className="field">
          Report type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setEntityId('');
              setReport(null);
            }}
          >
            {['Organization', 'Pilot', 'Aircraft', 'Battery'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {type !== 'Organization' && (
          <label className="field">
            Report entity
            <select
              value={entityId}
              onChange={(e) => {
                setEntityId(e.target.value);
                setReport(null);
              }}
            >
              <option value="">Select…</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          From
          <Input
            type="date"
            value={from}
            onInput={(e) => {
              setFrom(e.currentTarget.value);
              setReport(null);
            }}
          />
        </label>
        <label className="field">
          Through
          <Input
            type="date"
            value={to}
            onInput={(e) => {
              setTo(e.currentTarget.value);
              setReport(null);
            }}
          />
        </label>
      </div>
      {['Aircraft','Battery'].includes(type) && <label className="field"><span><input type="checkbox" checked={includeHistory} onChange={e=>{setIncludeHistory(e.target.checked);setReport(null)}} /> Include maintenance, inspections and battery history</span></label>}
      <Button
        onClick={() => {
          setError('');
          try {
            const parsed = reportRequestSchema.safeParse({
              type,
              includeHistory: includeHistory && ['Aircraft','Battery'].includes(type),
              entityId,
              from,
              to,
            });
            if (!parsed.success)
              throw Error(parsed.error.issues.map((i) => i.message).join('. '));
            const result = createFlightReport(
              parsed.data,
              app.records as ReportRecord[],
              app.profiles,
              app.equipmentAliases,
            );
            setReport(result);
            setPage(0);
            setGeneratedAt(new Date().toISOString());
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Preview report
      </Button>
      <label className="field">Saved export format<select value={format} onChange={e=>setFormat(e.target.value)}><option>CSV</option><option>PDF</option></select></label>
      <ReportJobs request={{ type, entityId, from, to, format, includeHistory: includeHistory && ['Aircraft','Battery'].includes(type) }} />
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <div className="page-heading">
            <div>
              <h2>{report.entityName}</h2>
              <p>
                {report.request.from} → {report.request.to} ·{' '}
                {report.flightCount} flights ·{' '}
                {(report.durationSeconds / 3600).toFixed(2)} hours ·{' '}
                {report.distanceKm.toFixed(2)} km
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [reportCsv(report, app.organization.name, generatedAt)],
                    { type: 'text/csv;charset=utf-8' },
                  ),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = `aerolog-${report.request.type.toLowerCase()}-${report.request.from}-${report.request.to}.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download preview CSV
            </Button>
          </div>
          <p>
            {report.undatedExcluded} undated flights excluded ·{' '}
            {report.unattributedPilots} flights with an unattributed pilot.
          </p>
          <div className="report-table-scroll" role="region" aria-label="Flight report table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {[
                    'Date',
                    'Mission',
                    'Pilot',
                    'Aircraft',
                    'Duration',
                    'Distance',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(page * 25, (page + 1) * 25).map((row) => (
                  <tr key={row[0]}>
                    <td>{row[1]}</td>
                    <td>
                      {row[3]}
                      <small>{row[0]}</small>
                    </td>
                    <td>{row[4]}</td>
                    <td>{row[6]}</td>
                    <td>{(Number(row[8]) / 60).toFixed(1)} min</td>
                    <td>{Number(row[9]).toFixed(2)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="row report-pagination" aria-label="Flight report pages">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of{' '}
              {Math.max(1, Math.ceil(report.rows.length / 25))}
            </span>
            <Button
              variant="outline"
              disabled={(page + 1) * 25 >= report.rows.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </nav>
          {report.history && <ReportHistory key={generatedAt} history={report.history} />}
          {report.notes.map((note) => (
            <p className="fine-print" key={note}>
              {note}
            </p>
          ))}
          <p className="fine-print">
            Preview calculated at {generatedAt}. Source flight IDs and record
            revisions are included in the CSV.
          </p>
        </>
      )}
    </section>
  );
}
