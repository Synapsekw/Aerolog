'use client';
import { useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  batteryReadingRecordSchema,
  capacityRatio,
  latestDeviceCycles,
  type BatteryReadingRecord,
} from '@/lib/battery/readings';
export default function BatteryReadingLedger({ battery }: { battery: any }) {
  const app = useApp(),
    readings = (app.items('battery_reading') as BatteryReadingRecord[])
      .filter((r) => r.batteryId === battery.id)
      .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt));
  const [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [metric, setMetric] = useState('health');
  const allowed = ['admin', 'manager', 'technician'].includes(app.profile.role);
  async function save() {
    setError('');
    setSaving(true);
    try {
      const parsed = batteryReadingRecordSchema.safeParse(draft);
      if (!parsed.success)
        throw Error(parsed.error.issues.map((i) => i.message).join('. '));
      await api('battery-readings', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      await app.refresh();
      setDraft(null);
      app.notify('Battery reading saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="glass battery-reading-ledger">
      <div className="row">
        <div>
          <span className="eyebrow">MEASURED BATTERY HISTORY</span>
          <h2>Reading ledger</h2>
          <p>
            Register: {battery.cycles} cycles · Latest device reading:{' '}
            {latestDeviceCycles(readings) ?? 'Unknown'}
          </p>
        </div>
        {allowed && (
          <Button
            variant="outline"
            onClick={() => {
              setError('');
              setDraft({
                id: 'BR-' + crypto.randomUUID(),
                batteryId: battery.id,
                measuredAt: new Date().toISOString(),
                source: 'Device reading',
                deviceCycles: null,
                charge: null,
                health: null,
                temperature: null,
                voltage: null,
                fullCapacityMah: null,
                designCapacityMah: null,
                notes: '',
                applyToRegister: false,
              });
            }}
          >
            Record measurement
          </Button>
        )}
      </div>
      <p>
        Device counters and imported baselines are absolute readings. They are
        never added together. Flight usage is tracked separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {draft && (
        <div className="inspection-form">
          <label className="field">
            Measured at (UTC)
            <Input
              type="datetime-local"
              value={draft.measuredAt.slice(0, 16)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  measuredAt: e.target.value ? e.target.value + ':00Z' : '',
                })
              }
            />
          </label>
          <label className="field">
            Reading source
            <select
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            >
              {[
                'Device reading',
                'Manual measurement',
                'Imported baseline',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="inspection-meters">
            {[
              ['deviceCycles', 'Absolute cycles'],
              ['charge', 'Charge (%)'],
              ['health', 'Reported health (%)'],
              ['temperature', 'Temperature (°C)'],
              ['voltage', 'Voltage (V)'],
              ['fullCapacityMah', 'Measured full capacity (mAh)'],
              ['designCapacityMah', 'Rated capacity (mAh)'],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <Input
                  type="number"
                  step="any"
                  placeholder="Unknown"
                  value={draft[key] ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="field">
            Measurement notes
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.applyToRegister}
              onChange={(e) =>
                setDraft({ ...draft, applyToRegister: e.target.checked })
              }
            />{' '}
            Update register with these absolute cycles, health and temperature
            readings
          </label>
          <p>
            Older readings and decreasing cycle counts can be kept as history,
            but cannot overwrite the register. A reading never clears
            unverified, quarantined or retired status.
          </p>
          <div className="row">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save reading'}
            </Button>
          </div>
        </div>
      )}
      <label className="field">
        Trend
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          aria-label="Battery reading trend"
        >
          {[
            ['health', 'Reported health (%)'],
            ['deviceCycles', 'Absolute cycle count'],
            ['temperature', 'Temperature (°C)'],
            ['voltage', 'Voltage (V)'],
            ['fullCapacityMah', 'Full capacity (mAh)'],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {readings.some((r) => (r as any)[metric] != null) ? (
        <ChartContainer
          className="activity-chart"
          config={{ value: { label: metric, color: '#cdef8f' } }}
        >
          <LineChart
            data={readings
              .slice()
              .reverse()
              .map((r) => ({
                date: new Date(r.measuredAt).toLocaleString(),
                value: (r as any)[metric],
              }))}
          >
            <CartesianGrid vertical={false} stroke="#ffffff10" />
            <XAxis dataKey="date" minTickGap={60} />
            <YAxis width={50} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="linear"
              dataKey="value"
              stroke="#cdef8f"
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <p>No measured values for this trend.</p>
      )}
      <div className="reading-history">
        {readings.map((r) => (
          <article className="inspection-rule" key={r.id}>
            <div className="row">
              <strong>{r.source}</strong>
              <span>{new Date(r.measuredAt).toLocaleString()}</span>
            </div>
            <p>
              {r.deviceCycles == null
                ? 'Cycles unknown'
                : `${r.deviceCycles} absolute cycles`}{' '}
              · {r.voltage == null ? 'Voltage unknown' : `${r.voltage} V`} ·{' '}
              {r.temperature == null
                ? 'Temperature unknown'
                : `${r.temperature}°C`}
            </p>
            <p>
              Charge {r.charge ?? '—'}% · Reported health {r.health ?? '—'}% ·
              Measured / rated capacity {r.fullCapacityMah ?? '—'} /{' '}
              {r.designCapacityMah ?? '—'} mAh
              {capacityRatio(r) != null
                ? ` (${capacityRatio(r)!.toFixed(1)}%)`
                : ''}
            </p>
            <p>{r.notes}</p>
            <small>
              {r.recordedBy} ·{' '}
              {r.applyToRegister ? 'Applied to register' : 'History only'}
            </small>
          </article>
        ))}
        {!readings.length && (
          <p>
            No dated measurements recorded. The imported register counter
            remains separate from this ledger.
          </p>
        )}
      </div>
    </section>
  );
}
