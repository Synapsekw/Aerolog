import type { Battery, Flight } from '../domain/models';
type Reading = {
  time: number;
  charge?: number;
  voltage?: number;
  temperature?: number;
  fullCapacityMah?: number;
  designCapacityMah?: number;
  cellVoltages?: number[];
};
export function batteryFlightHistory(
  battery: Battery,
  inventory: Battery[],
  flights: Flight[],
) {
  const serial = battery.serial?.trim();
  const uniqueSerial =
    !!serial &&
    inventory.filter((b) => b.serial?.trim() === serial).length === 1;
  return flights
    .flatMap((flight) => {
      const ids = flight.batteryIds?.length
        ? flight.batteryIds
        : flight.battery
          ? [flight.battery]
          : [];
      const linked = ids.includes(battery.id);
      const serialLinked =
        uniqueSerial &&
        (flight.batterySerials?.includes(serial!) ||
          flight.telemetry.some((p) =>
            p.batteryPacks?.some((b) => b.serial === serial),
          ));
      if (!linked && !serialLinked) return [];
      const readings: Reading[] = [];
      for (const frame of flight.telemetry) {
        const packs = uniqueSerial
          ? frame.batteryPacks?.filter((p) => p.serial === serial)
          : undefined;
        if (packs?.length === 1)
          readings.push({ time: frame.time, ...packs[0] });
        else if (
          !frame.batteryPacks?.length &&
          ids.length === 1 &&
          linked &&
          (!flight.batterySerials?.length ||
            (uniqueSerial &&
              flight.batterySerials.length === 1 &&
              flight.batterySerials[0] === serial))
        )
          readings.push({ ...frame, charge: frame.battery });
      }
      const values = (key: 'voltage' | 'temperature' | 'fullCapacityMah') =>
        readings.flatMap((r) => (r[key] == null ? [] : [r[key]!]));
      const voltage = values('voltage'),
        temperature = values('temperature'),
        capacity = values('fullCapacityMah');
      const ratio = readings
        .filter((r) => r.fullCapacityMah != null && r.designCapacityMah != null)
        .at(-1);
      const spreads = readings.flatMap((r) =>
        r.cellVoltages && r.cellVoltages.length > 1
          ? [Math.max(...r.cellVoltages) - Math.min(...r.cellVoltages)]
          : [],
      );
      const charge = readings.filter((r) => r.charge != null);
      const increasingTime = charge.every(
        (r, i) => i === 0 || r.time > charge[i - 1].time,
      );
      const discharging = charge.every(
        (r, i) => i === 0 || r.charge! <= charge[i - 1].charge!,
      );
      const seconds =
        charge.length > 1 ? charge.at(-1)!.time - charge[0].time : 0;
      return [
        {
          id: flight.id,
          date: flight.startedAt || flight.date,
          label: flight.mission,
          samples: readings.length,
          capacityMah: capacity.at(-1) ?? null,
          capacityRatio: ratio
            ? (100 * ratio.fullCapacityMah!) / ratio.designCapacityMah!
            : null,
          minVoltage: voltage.length ? Math.min(...voltage) : null,
          peakTemperature: temperature.length ? Math.max(...temperature) : null,
          cellSpread: spreads.length ? Math.max(...spreads) : null,
          dischargeRate:
            increasingTime && discharging && seconds > 0
              ? (charge[0].charge! - charge.at(-1)!.charge!) / (seconds / 60)
              : null,
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
