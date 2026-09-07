export type CalendarEntry = {
  id: string;
  kind: string;
  name: string;
  date: string;
  time: string;
  status: string;
  durationMinutes?: number;
};

// Resolve only unique wall-clock times. DST gaps/overlaps need an explicit user
// choice; a date reminder is safer than silently moving the scheduled mission.
function uniqueInstant(date: string, time: string, timezone: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const wall = Date.parse(`${date}T${time}:00Z`);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const local = (instant: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
      return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    };
    const offsets = new Set([-48, -24, 0, 24, 48].map(hours => { const instant = wall + hours * 3600000; return local(instant) - instant; }));
    const candidates = [...offsets].map(offset => wall - offset).filter(instant => local(instant) === wall);
    return candidates.length === 1 ? candidates[0] : null;
  } catch { return null; }
}

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

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

export function calendarExport(entries: CalendarEntry[], scope: { organizationId: string; from: string; through: string; kind: string; timezone?: string }, generatedAt = new Date()) {
  const selected = entries.filter(e => e.date >= scope.from && e.date <= scope.through && (scope.kind === 'All' || e.kind === scope.kind))
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(Date.parse(e.date)) && new Date(e.date).toISOString().slice(0, 10) === e.date);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AeroLog//Operations calendar//EN', 'CALSCALE:GREGORIAN'];
  let dateOnlyMissions = 0;
  for (const e of selected) {
    const next = new Date(Date.parse(e.date) + 86400000).toISOString().slice(0, 10);
    const start = e.kind === 'mission' && scope.timezone && Number.isFinite(e.durationMinutes) && e.durationMinutes! > 0 && e.durationMinutes! <= 720
      ? uniqueInstant(e.date, e.time, scope.timezone) : null;
    if (e.kind === 'mission' && start === null) dateOnlyMissions++;
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(scope.organizationId)}.${encodeURIComponent(e.kind)}.${encodeURIComponent(e.id)}@aerolog`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      ...(start === null ? [`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.replace(/-/g, '')}`] : [`DTSTART:${utcStamp(new Date(start))}`, `DTEND:${utcStamp(new Date(start + e.durationMinutes! * 60000))}`]),
      `SUMMARY:${escapeText(e.name)}`,
      `DESCRIPTION:${escapeText(`${e.kind} · ${e.status}\nRecord: ${e.id}${e.time ? `\nScheduled time: ${e.time} (${scope.timezone || 'organization schedule'})` : ''}\n${start === null ? 'Date-only reminder. Mission time may be missing or ambiguous.' : `Duration: ${e.durationMinutes} minutes.`} Check AeroLog for current times and readiness.`)}`,
      'CLASS:PRIVATE', 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return { content: lines.map(fold).join('\r\n') + '\r\n', count: selected.length, dateOnlyMissions };
}
