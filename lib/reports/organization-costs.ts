import type { ReportRecord } from './flight-report';
import { maintenanceCosts } from './maintenance-costs';

export type CostProjectScope = { mode: 'all' | 'unallocated' | 'project'; projectId?: string };
export function organizationCosts(records: ReportRecord[], from: string, to: string, projectScope?: CostProjectScope) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(from) || !validDate(to) || from > to) throw Error('Choose a valid start and end date.');
  if (projectScope?.mode === 'project' && !projectScope.projectId) throw Error('Choose a project.');
  const projectColumns = Boolean(projectScope) || records.some(r=>r.kind==='service' && r.data.projectId);
  let undatedExcluded = 0;
  const rows: (string | number)[][] = [];
  for (const record of records.filter(r => r.kind === 'service')) {
    const d = record.data;
    if (projectScope?.mode === 'project' && d.projectId !== projectScope.projectId) continue;
    if (projectScope?.mode === 'unallocated' && d.projectId) continue;
    const value = d.completedAt || d.due || '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? validDate(value) ? value : '' : Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 10) : '';
    if (!date) { undatedExcluded++; continue; }
    if (date < from || date > to) continue;
    // Preserve the service's recorded identity; no name-based equipment merge.
    rows.push([date, d.completedAt ? 'Completion date (UTC)' : 'Scheduled due date', 'service', record.id, d.task || '', d.status || '', d.signedBy || d.technician || '', d.cost ?? '', d.currency || '', record.revision, d.targetKind || '', d.targetId || '', d.asset || '', d.costReference || '']);
    if(projectColumns) rows[rows.length-1].push(d.projectId || '', d.projectSnapshot?.name || (d.projectId ? 'Project name unavailable' : 'Unallocated'), d.projectSnapshot?.reference || '', d.projectSnapshot?.revision ?? '');
  }
  rows.sort((a,b) => String(a[0]).localeCompare(String(b[0])) || String(a[3]).localeCompare(String(b[3])));
  const scopeLabel = projectScope ? projectScope.mode === 'project' ? `Project ID: ${projectScope.projectId}` : projectScope.mode === 'unallocated' ? 'Unallocated / organization overhead' : 'All projects and unallocated work' : undefined;
  return { version: 1, from, to, rows, projectColumns, scopeLabel, undatedExcluded, ...maintenanceCosts(rows) };
}

export function organizationCostsCsv(report: ReturnType<typeof organizationCosts>, organization: string, generatedAt: string) {
  const cell = (value: string | number) => {
    const text = String(value), safe = typeof value === 'string' && /^\s*[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"','""') + '"';
  };
  const rows: (string|number)[][] = [
    ['AeroLog organization maintenance costs', report.version], ['Organization', organization], ['From', report.from], ['Through', report.to], ['Snapshot', generatedAt],
    ...(report.scopeLabel ? [['Project scope',report.scopeLabel]] : []),
    ['Basis', 'Recorded work-order amounts, not payments or recognized expenses. No currency conversion. Completed work uses completion dates; other work uses due dates.'],
    ['Undated excluded', report.undatedExcluded], ['Missing costs', report.missingCost], ['Invalid amounts', report.invalidCost], ['Missing or invalid currency', report.missingCurrency], [],
    ['Currency','Completed costs','Completed work orders','Open costs','Open work orders'],
    ...report.totals.map(t => [t.currency,t.completed,t.completedCount,t.open,t.openCount]), [],
    ['Date','Date basis','Source kind','Source ID','Work','Status','Technician','Recorded cost','Currency','Source revision','Equipment kind','Equipment ID','Recorded equipment name','Cost reference',...(report.projectColumns ? ['Project ID','Recorded project name','Recorded project reference','Project revision'] : [])], ...report.rows,
  ];
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
