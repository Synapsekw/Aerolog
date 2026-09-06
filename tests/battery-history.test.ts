import test from 'node:test';
import assert from 'node:assert/strict';
import { batteryFlightHistory } from '../lib/battery/history';
import type { Battery, Flight } from '../lib/domain/models';
const one = { id: 'B1', serial: 'SERIAL1' } as Battery,
  two = { id: 'B2', serial: 'SERIAL2' } as Battery;
const base = {
  id: 'F1',
  date: '2026-09-06',
  mission: 'Flight',
  batteryIds: ['B1', 'B2'],
  battery: 'B1',
};
test('separate pack readings stay with their physical battery', () => {
  const flight = {
    ...base,
    telemetry: [0, 60].map((time) => ({
      time,
      batteryPacks: [
        {
          serial: 'SERIAL1',
          charge: 90 - time / 6,
          voltage: 24 - time / 60,
          fullCapacityMah: 5000,
          designCapacityMah: 6000,
          cellVoltages: [4, 4.1],
        },
        {
          serial: 'SERIAL2',
          charge: 80,
          voltage: 22,
          fullCapacityMah: 4000,
          designCapacityMah: 6000,
        },
      ],
    })),
  } as Flight;
  const a = batteryFlightHistory(one, [one, two], [flight])[0],
    b = batteryFlightHistory(two, [one, two], [flight])[0];
  assert.equal(a.capacityMah, 5000);
  assert.equal(b.capacityMah, 4000);
  assert.equal(a.minVoltage, 23);
  assert.equal(b.minVoltage, 22);
  assert.equal(a.dischargeRate, 10);
  assert(Math.abs(a.cellSpread! - 0.1) < 1e-10);
});
test('combined readings are not assigned to both packs', () => {
  const flight = {
    ...base,
    telemetry: [
      { time: 0, voltage: 48 },
      { time: 60, voltage: 47 },
    ],
  } as Flight;
  assert.equal(
    batteryFlightHistory(one, [one, two], [flight])[0].minVoltage,
    null,
  );
});
test('ambiguous inventory serial prevents pack attribution', () => {
  const flight = {
    ...base,
    telemetry: [
      { time: 0, batteryPacks: [{ serial: 'SERIAL1', voltage: 24 }] },
    ],
  } as Flight;
  assert.equal(
    batteryFlightHistory(one, [one, { ...two, serial: 'SERIAL1' }], [flight])[0]
      .minVoltage,
    null,
  );
});
test('single battery legacy assignment works but charge increases invalidate discharge rate', () => {
  const flight = {
    ...base,
    batteryIds: ['B1'],
    telemetry: [
      { time: 0, battery: 80, voltage: 24 },
      { time: 60, battery: 90, voltage: 25 },
    ],
  } as Flight;
  const row = batteryFlightHistory(one, [one, two], [flight])[0];
  assert.equal(row.minVoltage, 24);
  assert.equal(row.dischargeRate, null);
});
