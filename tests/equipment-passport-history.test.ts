import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentPassportHistory } from '../lib/domain/equipment-passport-history';
import type { EquipmentAlias } from '../lib/domain/equipment-identity';
test('passport combines typed identity history once and retains source records', () => {
  const aliases: EquipmentAlias[] = [
    { kind: 'asset', source_id: 'old', canonical_id: 'new' },
  ];
  const data: Record<string, any[]> = {
    asset: [
      { id: 'old', name: 'Aircraft' },
      { id: 'new', name: 'Aircraft' },
    ],
    flight: [
      { id: 'both', aircraftId: 'old', equipmentIds: ['new'] },
      { id: 'legacy', aircraft: 'Aircraft' },
      { id: 'wrong', aircraftId: 'other', aircraft: 'Aircraft' },
      { id: 'wrong-equipment', equipmentIds: ['other'], aircraft: 'Aircraft' },
    ],
    service: [
      { id: 'job', targetKind: 'asset', targetId: 'old' },
      { id: 'wrong', targetKind: 'battery', targetId: 'old' },
    ],
    attachment: [{ id: 'file', targetKind: 'asset', targetId: 'new' }],
    inspection_plan: [{ id: 'plan', targetKind: 'asset', targetId: 'old' }],
    inspection_event: [
      { id: 'event', planId: 'plan' },
      { id: 'other', planId: 'unrelated' },
    ],
  };
  const original = JSON.stringify(data);
  const result = equipmentPassportHistory(
    { kind: 'asset', id: 'new' },
    aliases,
    (k) => data[k] || [],
  );
  assert.deepEqual(
    result.flights.map((f) => f.id),
    ['both', 'legacy'],
  );
  assert.deepEqual(
    result.services.map((f) => f.id),
    ['job'],
  );
  assert.equal(result.files.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.services[0].targetId, 'old');
  assert.equal(result.sources.length, 2);
  assert.equal(JSON.stringify(data), original);
  data.asset.push({ id: 'unrelated', name: 'Aircraft' });
  assert.deepEqual(
    equipmentPassportHistory(
      { kind: 'asset', id: 'old' },
      aliases,
      (k) => data[k] || [],
    ).flights.map((f) => f.id),
    ['both'],
  );
});
test('battery family does not confuse assets or sum counters', () => {
  const data: Record<string, any[]> = {
    battery: [
      { id: 'a', cycles: 12 },
      { id: 'b', cycles: 20 },
    ],
    flight: [
      { id: 'f', batteryIds: ['a', 'b'] },
      { id: 'not', aircraftId: 'a' },
    ],
    battery_event: [
      { id: 'event', battery: 'a', cycles: 12 },
      { id: 'not', battery: 'other' },
    ],
  };
  const result = equipmentPassportHistory(
    { kind: 'battery', id: 'b' },
    [{ kind: 'battery', source_id: 'a', canonical_id: 'b' }],
    (k) => data[k] || [],
  );
  assert.deepEqual(
    result.flights.map((f) => f.id),
    ['f'],
  );
  assert.deepEqual(
    result.sources.map((f) => f.cycles),
    [12, 20],
  );
  assert.deepEqual(
    result.batteryEvents.map((f) => f.id),
    ['event'],
  );
});
