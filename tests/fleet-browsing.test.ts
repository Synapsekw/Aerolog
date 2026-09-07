import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryGroup } from '../lib/battery/groups';
import { flightLocation } from '../lib/flight/location';
import type { Flight } from '../lib/domain/models';
test('battery grouping preserves pack variants and avoids interpreting serials as models', () => {
  assert.equal(batteryGroup({ model: 'M600 PART 10 Battery TB48S' }), 'TB48S');
  assert.equal(batteryGroup({ model: 'TB47S' }), 'TB47S');
  assert.equal(batteryGroup({ model: 'M350 94' }), 'M350 series');
  assert.equal(batteryGroup({ model: '1Z6PJ8WFA123' }), 'Other / unidentified');
  assert.equal(
    batteryGroup({ model: 'DJI Mavic 3 Battery 16' }),
    'Mavic 3 series',
  );
});
test('globe uses recorded positions and never invents a location', () => {
  assert.deepEqual(
    flightLocation({ flightTrack: [[48, 29, 130]] } as Flight),
    [48, 29],
  );
  assert.deepEqual(flightLocation({ siteLocation: [0, 0] } as Flight), [0, 0]);
  assert.equal(flightLocation({} as Flight), undefined);
  assert.equal(
    flightLocation({ siteLocation: [190, 29] } as Flight),
    undefined,
  );
});
