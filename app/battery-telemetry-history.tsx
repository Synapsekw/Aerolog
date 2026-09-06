'use client';
import { useMemo, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { batteryFlightHistory } from '@/lib/battery/history';
import type { Battery, Flight } from '@/lib/domain/models';
const metrics = {
  capacityMah: ['Reported full capacity', 'mAh'],
  capacityRatio: ['Full / design capacity', '%'],
  minVoltage: ['Minimum voltage', 'V'],
  peakTemperature: ['Peak temperature', '°C'],
  cellSpread: ['Maximum cell imbalance', 'V'],
  dischargeRate: ['Observed discharge rate', '%/min'],
} as const;
export default function BatteryTelemetryHistory({
  battery,
  inventory,
  flights,
  onFlight,
}: {
  battery: Battery;
  inventory: Battery[];
  flights: Flight[];
  onFlight: (id: string) => void;
}) {
  const history = useMemo(
    () => batteryFlightHistory(battery, inventory, flights),
    [battery, inventory, flights],
  );
  const [metric, setMetric] = useState<keyof typeof metrics>('capacityMah');
  const [title, unit] = metrics[metric];
  const measured = history.filter((h) => h[metric] != null);
  return (
    <section className="battery-telemetry-history">
      <h3 className="detail-heading">Battery telemetry trends</h3>
      <label className="field">
        <span>Measurement</span>
        <select
          aria-label="Battery history measurement"
          value={metric}
          onChange={(e) => setMetric(e.target.value as keyof typeof metrics)}
        >
          {Object.entries(metrics).map(([key, [label, u]]) => (
            <option key={key} value={key}>
              {label} ({u})
            </option>
          ))}
        </select>
      </label>
      <p className="fine-print">
        {measured.length} of {history.length} linked flights contain this
        measurement. Capacity ratios come from reported full and design
        capacity; cycle counts do not determine health.
      </p>
      {measured.length > 0 ? (
        <ChartContainer
          className="activity-chart"
          config={{
            [metric]: { label: `${title} (${unit})`, color: '#89dcda' },
          }}
        >
          <LineChart data={history}>
            <CartesianGrid vertical={false} stroke="#ffffff10" />
            <XAxis
              dataKey="date"
              minTickGap={50}
              tickFormatter={(v) => (v ? v.slice(0, 10) : 'Undated')}
            />
            <YAxis width={55} domain={['auto', 'auto']} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey={metric}
              type="linear"
              stroke="#89dcda"
              connectNulls={false}
              isAnimationActive={false}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <div className="info-box">
          No {title.toLowerCase()} readings. Import telemetry with this
          battery’s serial or an unambiguous single-battery assignment.
        </div>
      )}
      {measured.length > 0 && (
        <details>
          <summary>View measured flights ({measured.length})</summary>
          <div className="battery-measured-flights">
            {measured.map((row) => (
              <Button
                key={row.id}
                variant="ghost"
                className="battery-measured-flight"
                onClick={() => onFlight(row.id)}
              >
                <span>
                  {row.label}
                  <small>{row.date || 'Undated'}</small>
                </span>
                <strong>
                  {row[metric]!.toFixed(2)} {unit}
                </strong>
              </Button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
