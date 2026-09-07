import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarExport } from '../lib/operations/calendar-export';

test('calendar export scopes dates and categories and preserves exclusive date end', () => {
  const base = { id: 'same', kind: 'service', name: 'Inspection', date: '2026-12-31', time: '', status: 'Scheduled' };
  const scope = { organizationId: 'org-a', from: '2026-12-31', through: '2026-12-31', kind: 'service' };
  const result = calendarExport([base, { ...base, kind: 'mission' }, { ...base, date: '2027-01-01' }, { ...base, date: '' }], scope);
  assert.equal(result.count, 1);
  assert.match(result.content, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(result.content, /UID:org-a.service.same@aerolog/);
  assert.match(calendarExport([base], { ...scope, organizationId: 'org-b' }).content, /UID:org-b.service.same@aerolog/);
  assert.equal(calendarExport([{ ...base, date: '2026-02-30' }], { ...scope, from: '2026-01-01', through: '2026-12-31' }).count, 0);
});

test('calendar text cannot inject properties and UTF-8 folding preserves full text', () => {
  const name = '航空🚁'.repeat(40) + '\nATTENDEE:intruder,one;two\\three';
  const result = calendarExport([{ id: 'x\r\nEND:VEVENT', kind: 'mission', name, date: '2026-09-07', time: '09:00', status: 'Draft' }], { organizationId: 'org', from: '2026-09-07', through: '2026-09-07', kind: 'All' }, new Date('2026-09-07T12:34:56Z'));
  for (const line of result.content.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = result.content.replace(/\r\n /g, '');
  assert.equal(unfolded.split('BEGIN:VEVENT').length - 1, 1);
  assert.equal(unfolded.split('\r\nEND:VEVENT').length - 1, 1);
  assert.ok(unfolded.includes('航空🚁'.repeat(40)));
  assert.ok(unfolded.includes('\\nATTENDEE:intruder\\,one\\;two\\\\three'));
  assert.match(unfolded, /DTSTAMP:20260907T123456Z/);
  assert.ok(unfolded.includes('Scheduled time: 09:00'));
});
