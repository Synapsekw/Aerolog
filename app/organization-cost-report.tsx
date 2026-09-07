'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { organizationCosts, organizationCostsCsv } from '@/lib/reports/organization-costs';
import ReportJobs from './report-jobs';

export default function OrganizationCostReport() {
  const app = useApp();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: app.organization.settings?.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [from,setFrom] = useState(today.slice(0,4)+'-01-01'), [to,setTo] = useState(today), [error,setError] = useState(''), [page,setPage] = useState(0);
  const [snapshot,setSnapshot] = useState<{ report: ReturnType<typeof organizationCosts>; at: string; organization: string } | null>(null);
  const [format,setFormat] = useState('CSV');
  return <details className="organization-cost-report">
    <summary>Organization maintenance costs</summary>
    <p>Review recorded work-order costs across all equipment. Completed work uses completion dates; open work uses scheduled due dates.</p>
    <div className="form-grid"><label className="field">Costs from<Input type="date" value={from} onInput={e=>{setFrom(e.currentTarget.value);setSnapshot(null)}} /></label><label className="field">Costs through<Input type="date" value={to} onInput={e=>{setTo(e.currentTarget.value);setSnapshot(null)}} /></label></div>
    <Button variant="outline" onClick={()=>{try{setSnapshot({report:organizationCosts(app.records,from,to),at:new Date().toISOString(),organization:app.organization.name});setPage(0);setError('')}catch(e){setError((e as Error).message)}}}>Preview organization costs</Button>
    {error && <p role="alert">{error}</p>}
    <label className="field">Saved cost export format<select value={format} onChange={e=>setFormat(e.target.value)}><option>CSV</option><option>PDF</option></select></label>
    <ReportJobs request={{type:'Maintenance costs',from,to,format}} />
    {snapshot && <>
      <p>{snapshot.report.serviceCount} work orders · {snapshot.report.missingCost} missing costs · {snapshot.report.missingCurrency} missing or invalid currencies · {snapshot.report.invalidCost} invalid amounts · {snapshot.report.undatedExcluded} undated excluded.</p>
      <p className="fine-print">Currencies remain separate. Missing costs are excluded; recorded zero costs are included. These are work-order amounts, not payment or recognized expense totals.</p>
      <div className="report-table-scroll" role="region" aria-label="Organization maintenance cost totals" tabIndex={0}><table><thead><tr><th>Currency</th><th>Completed work</th><th>Open work</th></tr></thead><tbody>{snapshot.report.totals.map(t=><tr key={t.currency}><th scope="row">{t.currency}</th><td>{t.completed}<small>{t.completedCount} work orders</small></td><td>{t.open}<small>{t.openCount} work orders</small></td></tr>)}</tbody></table></div>
      <div className="report-table-scroll" role="region" aria-label="Organization cost work orders" tabIndex={0}><table><thead><tr>{['Date','Equipment','Work','Status','Cost','Currency'].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{snapshot.report.rows.slice(page*25,(page+1)*25).map(r=><tr key={r[3]}><td>{r[0]}</td><td>{r[12]}<small>{r[10]} {r[11] || 'No stable equipment ID'}</small></td><td>{r[4]}<small>{r[3]} · revision {r[9]}</small></td><td>{r[5]}</td><td>{r[7] === '' ? 'Not recorded' : r[7]}</td><td>{r[8]}</td></tr>)}</tbody></table></div>
      {!snapshot.report.rows.length && <p>No work orders in this date range.</p>}
      <nav className="row report-pagination" aria-label="Organization cost pages"><Button variant="outline" disabled={!page} onClick={()=>setPage(page-1)}>Previous costs</Button><span>Page {page+1} of {Math.max(1,Math.ceil(snapshot.report.rows.length/25))}</span><Button variant="outline" disabled={(page+1)*25>=snapshot.report.rows.length} onClick={()=>setPage(page+1)}>Next costs</Button></nav>
      <Button variant="outline" onClick={()=>{const url=URL.createObjectURL(new Blob([organizationCostsCsv(snapshot.report,snapshot.organization,snapshot.at)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`aerolog-maintenance-costs-${snapshot.report.from}-${snapshot.report.to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Download all cost rows (CSV)</Button>
      <p className="fine-print">Snapshot {snapshot.at}. Export includes all pages and source revisions.</p>
    </>}
  </details>;
}
