import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batteryReadingRecordSchema,
  capacityRatio,
  latestDeviceCycles,
  type BatteryReadingRecord,
} from '../lib/battery/readings';
const reading = {
  id: 'R',
  batteryId: 'B',
  measuredAt: '2026-09-07T00:00:00Z',
  source: 'Device reading',
  deviceCycles: 20,
  charge: null,
  health: null,
  temperature: null,
  voltage: null,
  fullCapacityMah: null,
  designCapacityMah: null,
  notes: 'Device readout',
  applyToRegister: false,
};
test('device cycles are latest absolute readings, not a sum with baseline', () => {
  const a = batteryReadingRecordSchema.parse(reading);
  const b = {
    ...a,
    id: 'B',
    source: 'Imported baseline',
    deviceCycles: 90,
  } as BatteryReadingRecord;
  assert.equal(latestDeviceCycles([a, b]), 20);
  assert.equal(
    latestDeviceCycles([
      { ...a, measuredAt: '2026-09-08T00:00:00Z', deviceCycles: 22 },
      a,
    ]),
    22,
  );
});
test('capacity comparison does not invent health or require a 100 percent cap', () => {
  assert.equal(
    capacityRatio({ fullCapacityMah: 10500, designCapacityMah: 10000 }),
    105,
  );
  assert.equal(
    capacityRatio({ fullCapacityMah: null, designCapacityMah: 10000 }),
    null,
  );
  assert.equal(
    batteryReadingRecordSchema.safeParse({ ...reading, deviceCycles: null })
      .success,
    false,
  );
  assert.equal(
    batteryReadingRecordSchema.safeParse({ ...reading, deviceCycles: 1.5 })
      .success,
    false,
  );
});
