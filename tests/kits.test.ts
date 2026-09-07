import test from 'node:test';
import assert from 'node:assert/strict';
import { kitSchema, kitContents } from '../lib/operations/kits';
import type { Asset, Battery } from '../lib/domain/models';
test('kits reject repeated physical item references', () => {
  assert.equal(
    kitSchema.safeParse({
      id: 'K',
      name: 'Survey',
      items: [
        { kind: 'asset', id: 'A' },
        { kind: 'asset', id: 'A' },
      ],
    }).success,
    false,
  );
});
test('kit preview surfaces missing, retired and unverified items', () => {
  const kit = kitSchema.parse({
    id: 'K',
    name: 'Survey',
    items: [
      { kind: 'asset', id: 'A' },
      { kind: 'battery', id: 'B' },
      { kind: 'asset', id: 'M' },
    ],
  });
  const result = kitContents(
    kit,
    [{ id: 'A', name: 'Aircraft', status: 'Retired' } as Asset],
    [{ id: 'B', model: 'TB65', status: 'Unverified' } as Battery],
  );
  assert.deepEqual(
    result.map((r) => r.ready),
    [false, false, false],
  );
  assert.equal(result[2].status, 'Missing record');
});

test('kit assignment maps equipment and checks battery compatibility and measurements', async () => {
  const { kitAssignment } = await import('../lib/operations/kits');
  const kit = kitSchema.parse({
    id: 'K',
    name: 'Survey',
    items: [
      { kind: 'asset', id: 'A' },
      { kind: 'battery', id: 'B' },
    ],
  });
  const assets = [
    {
      id: 'A',
      name: 'Aircraft A',
      category: 'Aircraft',
      status: 'Available',
      hours: 10,
      next: 100,
    } as Asset,
  ];
  const batteries = [
    {
      id: 'B',
      model: 'TB65',
      status: 'Healthy',
      aircraft: 'Aircraft B',
      health: 95,
      temp: 30,
    } as Battery,
  ];
  const rules = { batteryMinHealth: 80, batteryMaxTemperature: 50 };
  assert.match(
    kitAssignment(kit, assets, batteries, '', rules).blockers.join(' '),
    /not assigned to Aircraft A/,
  );
  const result = kitAssignment(
    kit,
    assets,
    [{ ...batteries[0], aircraft: 'Aircraft A' }],
    '',
    rules,
  );
  assert.deepEqual(result.blockers, []);
  assert.equal(result.aircraft, 'Aircraft A');
  assert.deepEqual(result.equipment, ['B']);
  assert.match(
    kitAssignment(
      kit,
      assets,
      [{ ...batteries[0], aircraft: 'Aircraft A', health: null }],
      '',
      rules,
    ).blockers.join(' '),
    /measurements/,
  );
});
