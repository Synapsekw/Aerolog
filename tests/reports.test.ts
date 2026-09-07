import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFlightReport,
  reportCsv,
  type ReportRecord,
} from '../lib/reports/flight-report';
const members = [
  { id: 'p1', display_name: 'Same name' },
  { id: 'p2', display_name: 'Same name' },
];
const records: ReportRecord[] = [
  {
    id: 'a1',
    kind: 'asset',
    revision: 1,
    data: { name: 'Aircraft', category: 'Aircraft' },
  },
  { id: 'b1', kind: 'battery', revision: 1, data: { model: 'Pack' } },
  ...[
    {
      id: 'f1',
      date: '2026-09-06',
      pilotUserId: 'p1',
      pilot: 'Same name',
      aircraftId: 'a1',
      aircraft: 'Aircraft',
      batteryIds: ['b1', 'b1'],
      battery: 'b1',
      durationSeconds: 61,
      distance: '0.5',
      mission: '=HYPERLINK("bad")',
    },
    {
      id: 'f2',
      date: '2026-09-07',
      pilot: 'Same name',
      aircraftId: 'another',
      aircraft: 'Aircraft',
      battery: 'b1',
      durationSeconds: 120,
      distance: '1',
    },
    {
      id: 'f3',
      date: '',
      pilotUserId: 'p1',
      pilot: 'Same name',
      aircraft: 'Aircraft',
      durationSeconds: 600,
      distance: '5',
    },
    {
      id: 'f4',
      date: '2026-09-08',
      pilotUserId: 'p1',
      pilot: 'Same name',
      aircraft: 'Aircraft',
      durationSeconds: 600,
      distance: '5',
    },
  ].map((data) => ({ id: data.id, kind: 'flight', revision: 2, data })),
];
const period = { from: '2026-09-06', to: '2026-09-07' };
test('reports use inclusive dates, exact seconds and identity precedence', () => {
  const org = createFlightReport(
    { type: 'Organization', entityId: '', ...period },
    records,
    members,
  );
  assert.equal(org.flightCount, 2);
  assert.equal(org.durationSeconds, 181);
  assert.equal(org.distanceKm, 1.5);
  assert.equal(org.undatedExcluded, 1);
  assert.equal(org.unattributedPilots, 1);
  const pilot = createFlightReport(
    { type: 'Pilot', entityId: 'p1', ...period },
    records,
    members,
  );
  assert.equal(pilot.flightCount, 1);
  assert.equal(pilot.durationSeconds, 61);
  const aircraft = createFlightReport(
    { type: 'Aircraft', entityId: 'a1', ...period },
    records,
    members,
  );
  assert.equal(aircraft.flightCount, 1);
  const battery = createFlightReport(
    { type: 'Battery', entityId: 'b1', ...period },
    records,
    members,
  );
  assert.equal(battery.flightCount, 2);
  assert.equal(battery.rows[0][10], 'b1');
});
test('reports retain provenance and escape spreadsheet formulas', () => {
  const report = createFlightReport(
    { type: 'Organization', entityId: '', ...period },
    records,
    members,
  );
  assert.deepEqual(report.sourceReferences[0], {
    id: 'f1',
    kind: 'flight',
    revision: 2,
  });
  const csv = reportCsv(report, '=Organization', '2026-09-07T00:00:00Z');
  assert.match(csv, /'=Organization/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /Duration seconds/);
});
test('reports reject missing entities and invalid durations instead of silently changing totals', () => {
  assert.throws(
    () =>
      createFlightReport(
        { type: 'Pilot', entityId: 'unknown', ...period },
        records,
        members,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      createFlightReport(
        { type: 'Organization', entityId: '', ...period },
        [
          {
            id: 'bad',
            kind: 'flight',
            revision: 1,
            data: { date: '2026-09-07', durationSeconds: NaN },
          },
        ],
        members,
      ),
    /Invalid recorded duration/,
  );
});
