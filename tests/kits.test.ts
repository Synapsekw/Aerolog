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
