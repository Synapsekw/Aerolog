'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FlightReport } from '@/lib/reports/flight-report';

export default function ReportHistory({ history }: { history: NonNullable<FlightReport['history']> }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(history.rows.length / 25));
  const current = Math.min(page, pages - 1);
  return (
    <section>
      <h3>Equipment history · {history.rows.length} records</h3>
      <p>
        Completed services use completion date; open services use due date.
        Timestamped readings use UTC dates. Costs retain their original currencies.
      </p>
      <div className="report-table-scroll" role="region" aria-label="Equipment history table" tabIndex={0}>
        <table>
          <thead>
            <tr>{history.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {history.rows.slice(current * 25, (current + 1) * 25).map(row => (
              <tr key={String(row[2]) + ':' + String(row[3])}>
                {row.map((value, index) => <td key={index}>{value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!history.rows.length && <p>No equipment history falls within this period.</p>}
      <nav className="row report-pagination" aria-label="Equipment history pages">
        <Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous history</Button>
        <span>Page {current + 1} of {pages}</span>
        <Button variant="outline" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next history</Button>
      </nav>
      <p>{history.undatedExcluded} undated history records excluded. The CSV includes all pages.</p>
    </section>
  );
}
