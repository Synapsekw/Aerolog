'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FlightReport } from '@/lib/reports/flight-report';
import { maintenanceCosts } from '@/lib/reports/maintenance-costs';

export default function ReportHistory({ history }: { history: NonNullable<FlightReport['history']> }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(history.rows.length / 25));
  const current = Math.min(page, pages - 1);
  const costs = maintenanceCosts(history.rows);
  return (
    <section>
      <h3>Maintenance costs</h3>
      <p>Recorded work-order amounts, grouped by currency. Completed work uses completion dates; open work uses due dates. These totals do not establish payment or accounting expense.</p>
      <div className="report-table-scroll" role="region" aria-label="Maintenance cost totals" tabIndex={0}>
        <table><thead><tr><th scope="col">Currency</th><th scope="col">Completed work</th><th scope="col">Open work</th></tr></thead>
          <tbody>{costs.totals.map(total => <tr key={total.currency}><th scope="row">{total.currency}</th><td>{total.completed}<small>{total.completedCount} work orders</small></td><td>{total.open}<small>{total.openCount} work orders</small></td></tr>)}</tbody>
        </table>
      </div>
      {!costs.totals.length && <p>No work orders with a recorded cost and currency in this period.</p>}
      <p className="fine-print">{costs.serviceCount} work orders · {costs.missingCost} without costs · {costs.missingCurrency} without valid currency · {costs.invalidCost} invalid amounts. Missing and invalid amounts are excluded from totals. A recorded zero remains included.</p>
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
