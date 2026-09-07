export type CalendarEntry = {
  id: string;
  kind: string;
  name: string;
  date: string;
  time: string;
  status: string;
};

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 content lines are folded at 75 UTF-8 octets, never inside a code point.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '', width = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (width + size > 75) { result += '\r\n '; width = 1; }
    result += character; width += size;
  }
  return result;
}

export function calendarExport(entries: CalendarEntry[], scope: { organizationId: string; from: string; through: string; kind: string }, generatedAt = new Date()) {
  const selected = entries.filter(e => e.date >= scope.from && e.date <= scope.through && (scope.kind === 'All' || e.kind === scope.kind))
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(Date.parse(e.date)) && new Date(e.date).toISOString().slice(0, 10) === e.date);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AeroLog//Operations calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const e of selected) {
    const next = new Date(Date.parse(e.date) + 86400000).toISOString().slice(0, 10);
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(scope.organizationId)}.${encodeURIComponent(e.kind)}.${encodeURIComponent(e.id)}@aerolog`,
      `DTSTAMP:${generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.replace(/-/g, '')}`,
      `SUMMARY:${escapeText(e.name)}`,
      `DESCRIPTION:${escapeText(`${e.kind} · ${e.status}\nRecord: ${e.id}${e.time ? `\nScheduled time: ${e.time} (organization schedule)` : ''}\nDate-only snapshot. Check AeroLog for current times and readiness.`)}`,
      'CLASS:PRIVATE', 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { content: lines.map(fold).join('\r\n') + '\r\n', count: selected.length };
}
