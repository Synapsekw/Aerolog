'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { currencySummary } from '@/lib/operations/currency';
export default function CrewCurrency({
  person,
  onChange,
}: {
  person: any;
  onChange?: (key: string, value: any) => void;
}) {
  const app = useApp(),
    [entry, setEntry] = useState<any>(null);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: app.organization.settings?.timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const policy = person.currencyPolicy || {
    enabled: false,
    days: 90,
    minimumFlights: 0,
    minimumMinutes: 0,
    includeExternal: false,
  };
  const summary = currencySummary(person, app.items('flight'), today),
    ledger = person.externalTime || [];
  const saved =
    app.items('crew').find((c) => c.id === person.id)?.externalTime || [];
  const files = app
    .items('attachment')
    .filter((f) => f.targetKind === 'crew' && f.targetId === person.id);
  const update = (key: string, value: any) =>
    onChange?.('currencyPolicy', { ...policy, [key]: value });
  return (
    <section className="crew-credentials">
      <h3>Flight recency</h3>
      <p>
        {policy.enabled
          ? summary.met
            ? 'Requirement met'
            : 'Requirement not met'
          : 'No recency policy enabled'}
      </p>
      <p>
        {summary.start} through the day before {today}: {summary.localFlights}{' '}
        AeroLog flights / {summary.localMinutes.toFixed(1)} minutes;{' '}
        {summary.externalFlights} external flights /{' '}
        {summary.externalMinutes.toFixed(1)} minutes.
      </p>
      {onChange && (
        <>
          <label>
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />{' '}
            Require recency before mission submission
          </label>
          <div className="form-grid">
            {['days', 'minimumFlights', 'minimumMinutes'].map((k) => (
              <label className="field" key={k}>
                {
                  {
                    days: 'Preceding calendar days',
                    minimumFlights: 'Minimum flights',
                    minimumMinutes: 'Minimum flight minutes',
                  }[k]
                }
                <Input
                  type="number"
                  min={k === 'days' ? 1 : 0}
                  value={policy[k]}
                  onChange={(e) => update(k, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <label>
            <input
              type="checkbox"
              checked={policy.includeExternal}
              onChange={(e) => update('includeExternal', e.target.checked)}
            />{' '}
            Include manager-verified external time in recency checks
          </label>
        </>
      )}
      <p className="fine-print">
        Company-defined recency policy. Mission checks use the preceding
        calendar days, excluding the mission date. External time never increases
        AeroLog's recorded flight totals.
      </p>
      <h3>External flight time</h3>
      {ledger.map((e: any) => (
        <article className="inspection-rule" key={e.id}>
          <strong>
            {e.date} · {e.flights} flights · {e.minutes} minutes
          </strong>
          <p>{e.source}</p>
          <p>{e.notes}</p>
          <small>
            {e.recordedBy
              ? 'Verified by ' + e.recordedBy + ' · ' + e.recordedAt
              : 'Pending save and manager verification'}
          </small>
          {onChange && !saved.some((s: any) => s.id === e.id) && (
            <Button
              variant="ghost"
              onClick={() =>
                onChange(
                  'externalTime',
                  ledger.filter((v: any) => v.id !== e.id),
                )
              }
            >
              Remove unsaved entry
            </Button>
          )}
        </article>
      ))}
      {!ledger.length && <p>No external time recorded.</p>}
      {onChange && !entry && (
        <Button
          variant="outline"
          onClick={() =>
            setEntry({
              id: crypto.randomUUID(),
              date: today,
              flights: 1,
              minutes: 0,
              source: '',
              notes: '',
              evidenceId: '',
            })
          }
        >
          Record external time
        </Button>
      )}
      {entry && onChange && (
        <div className="inspection-rule">
          <div className="form-grid">
            {['date', 'flights', 'minutes', 'source'].map((k) => (
              <label className="field" key={k}>
                {
                  {
                    date: 'Flight date',
                    flights: 'Flight count',
                    minutes: 'Total minutes',
                    source: 'Source logbook',
                  }[k]
                }
                <Input
                  type={
                    k === 'date' ? 'date' : k === 'source' ? 'text' : 'number'
                  }
                  value={entry[k]}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      [k]: ['flights', 'minutes'].includes(k)
                        ? Number(e.target.value)
                        : e.target.value,
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="field">
            Verification notes
            <textarea
              value={entry.notes}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
            />
          </label>
          <label className="field">
            Evidence
            <select
              value={entry.evidenceId}
              onChange={(e) =>
                setEntry({ ...entry, evidenceId: e.target.value })
              }
            >
              <option value="">Select evidence</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Use distinct source entries and dates to avoid counting the same
            flights twice. Saved entries preserve their original evidence and
            totals.
          </p>
          <div className="row">
            <Button variant="outline" onClick={() => setEntry(null)}>
              Cancel entry
            </Button>
            <Button
              onClick={() => {
                onChange('externalTime', [...ledger, entry]);
                setEntry(null);
              }}
            >
              Add to profile
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
