import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarExport } from '../lib/operations/calendar-export';

test('mission export converts organization time to UTC and retains overnight duration', () => {
  const entry = { id: 'night', kind: 'mission', name: 'Night survey', date: '2026-12-31', time: '23:30', durationMinutes: 120, status: 'Approved' };
  const scope = { organizationId: 'org', from: '2026-01-01', through: '2026-12-31', kind: 'All', timezone: 'Asia/Dubai' };
  const result = calendarExport([entry], scope);
  assert.match(result.content, /DTSTART:20261231T193000Z\r\nDTEND:20261231T213000Z/);
  assert.equal(result.dateOnlyMissions, 0);
  const utc = calendarExport([entry], { ...scope, timezone: 'UTC' });
  assert.match(utc.content, /DTSTART:20261231T233000Z\r\nDTEND:20270101T013000Z/);
});

test('DST gaps, repeated times and invalid zones remain explicit date reminders', () => {
  const entry = { id: 'dst', kind: 'mission', name: 'Survey', date: '2026-03-08', time: '02:30', durationMinutes: 60, status: 'Draft' };
  const scope = { organizationId: 'org', from: '2026-01-01', through: '2026-12-31', kind: 'All', timezone: 'America/New_York' };
  for (const [e, s] of [[entry, scope], [{ ...entry, date: '2026-11-01', time: '01:30' }, scope], [entry, { ...scope, timezone: 'invalid' }]] as const) {
    const result = calendarExport([e], s);
    assert.equal(result.dateOnlyMissions, 1);
    assert.match(result.content, /DTSTART;VALUE=DATE:/);
  }
  const summer = calendarExport([{ ...entry, date: '2026-07-01', time: '09:00' }], scope);
  assert.match(summer.content, /DTSTART:20260701T130000Z/);
});

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
