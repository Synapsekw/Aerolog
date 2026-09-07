'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Status } from './shared';
import BatteryReadingLedger from './battery-reading-ledger';
import BatteryTelemetryHistory from './battery-telemetry-history';
import MissionMap from './mission-map';
import { flightLocation } from '@/lib/flight/location';
export default function EquipmentPassport({
  kind,
  record,
  onBack,
  onEdit,
  onService,
  onCycle,
  onOpen,
  onInspections,
}: {
  kind: 'asset' | 'battery';
  record: any;
  onBack: () => void;
  onEdit: () => void;
  onService: () => void;
  onCycle: () => void;
  onOpen: (kind: 'flight' | 'service', id: string) => void;
  onInspections: () => void;
}) {
  const app = useApp(),
    [tab, setTab] = useState('Overview'),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  const battery = kind === 'battery';
  const name = record.name || record.sourceName || record.model;
  const allowed = ['admin', 'manager', 'technician'].includes(app.profile.role);
  const flights = app
    .items('flight')
    .filter((f) =>
      battery
        ? f.battery === record.id || f.batteryIds?.includes(record.id)
        : f.aircraftId === record.id ||
          f.equipmentIds?.includes(record.id) ||
          f.aircraft === record.name,
    )
    .sort((a, b) =>
      (b.startedAt || b.date).localeCompare(a.startedAt || a.date),
    );
  const files = app
      .items('attachment')
      .filter((f) => f.targetKind === kind && f.targetId === record.id),
    services = app
      .items('service')
      .filter((s) => s.asset === record.name || s.targetId === record.id),
    plans = app
      .items('inspection_plan')
      .filter((p) => p.targetKind === kind && p.targetId === record.id),
    events = app
      .items('inspection_event')
      .filter((e) => plans.some((p) => p.id === e.planId));
  const storageSite = app
    .items('site')
    .find((s) => s.id === record.storageSiteId);
  const lastFlight = flights.find((f) => flightLocation(f));
  const point = lastFlight ? flightLocation(lastFlight) : undefined;
  const tabs = [
    'Overview',
    'Flights',
    'Maintenance',
    'Inspections',
    'Attachments',
    ...(battery ? ['Battery readings', 'Telemetry'] : []),
  ];
  return (
    <article className="equipment-passport-page">
      <Button variant="outline" onClick={onBack}>
        ← Back to inventory
      </Button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {battery ? 'BATTERY' : 'EQUIPMENT'} PASSPORT
          </span>
          <h1>{name}</h1>
          <p>
            {record.serial || 'Serial not recorded'} ·{' '}
            {record.category || record.aircraft}
          </p>
        </div>
        <Status>{record.status}</Status>
      </div>
      <div className="passport-actions">
        {allowed && (
          <>
            <Button onClick={onEdit}>
              {battery ? 'Edit / quarantine' : 'Edit equipment / custody'}
            </Button>
            {battery ? (
              <Button variant="outline" onClick={onCycle}>
                Record completed charge cycle
              </Button>
            ) : (
              <Button variant="outline" onClick={onService}>
                Schedule service
              </Button>
            )}
          </>
        )}
        <Button variant="outline" onClick={onInspections}>
          Manage inspection profiles
        </Button>
      </div>
      <div
        className="passport-tabs"
        role="tablist"
        aria-label="Equipment passport sections"
      >
        {tabs.map((t) => (
          <Button
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? 'default' : 'outline'}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'Flights'
              ? ` (${flights.length})`
              : t === 'Attachments'
                ? ` (${files.length})`
                : ''}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {tab === 'Overview' && (
        <div className="passport-columns">
          <section className="glass">
            <h2>Equipment record</h2>
            <dl className="summary-list">
              {[
                ['Name', name],
                ['Serial', record.serial || 'Unknown'],
                ['Manufacturer', record.manufacturer || 'Unknown'],
                ['Product model', record.productModel || 'Not recorded'],
                ['Firmware', record.firmware || 'Unknown'],
                [
                  'Storage site',
                  storageSite
                    ? storageSite.name +
                      (storageSite.archived ? ' (archived)' : '')
                    : 'Not assigned',
                ],
                ['Source', record.externalSource || 'AeroLog'],
                [
                  'Custodian / aircraft',
                  battery ? record.aircraft : record.pilot,
                ],
                [
                  'Recorded flight time',
                  `${(flights.reduce((n, f) => n + f.durationSeconds, 0) / 3600).toFixed(2)} h in this logbook`,
                ],
                ...(battery
                  ? [
                      [
                        'Rated capacity',
                        record.ratedCapacityMah == null
                          ? 'Unknown'
                          : record.ratedCapacityMah + ' mAh',
                      ],
                      [
                        'Nominal voltage',
                        record.nominalVoltage == null
                          ? 'Unknown'
                          : record.nominalVoltage + ' V',
                      ],
                      ['Register cycles', record.cycles],
                      [
                        'Reported health',
                        record.health == null ? 'Unknown' : record.health + '%',
                      ],
                      [
                        'Latest temperature',
                        record.temp == null ? 'Unknown' : record.temp + '°C',
                      ],
                    ]
                  : [
                      [
                        'Lifetime hours',
                        record.hours == null ? 'Unknown' : record.hours + ' h',
                      ],
                      [
                        'Next service',
                        record.next == null
                          ? 'Not configured'
                          : record.next + ' h',
                      ],
                      [
                        'Service interval',
                        record.intervalHours == null
                          ? 'Not configured'
                          : record.intervalHours + ' h',
                      ],
                    ]),
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p>{record.notes || 'No additional notes.'}</p>
          </section>
          <section className="glass">
            <h2>Assigned storage</h2>
            {storageSite ? (
              <>
                <p>
                  {storageSite.name}
                  {storageSite.archived ? ' (archived)' : ''} ·{' '}
                  {storageSite.address}
                </p>
                {storageSite.geometry?.length > 0 && (
                  <MissionMap points={storageSite.geometry} height={240} />
                )}
              </>
            ) : (
              <p>No storage site assigned.</p>
            )}
            <h2>Last observed flight location</h2>
            {point ? (
              <>
                <MissionMap points={[point]} height={360} />
                <p>
                  {lastFlight.date} · {lastFlight.mission}
                </p>
                <Button
                  variant="outline"
                  onClick={() => onOpen('flight', lastFlight.id)}
                >
                  Open flight
                </Button>
              </>
            ) : (
              <p>No flight coordinates available.</p>
            )}
            <p className="fine-print">
              A flight observation is not an equipment storage location.
            </p>
          </section>
        </div>
      )}
      {tab === 'Flights' && (
        <section className="glass passport-list">
          <h2>Linked flights</h2>
          {flights.map((f) => (
            <button
              key={f.id}
              className="linked-item"
              onClick={() => onOpen('flight', f.id)}
            >
              <span>
                {f.mission || f.id}
                <small>
                  {f.date || 'Unknown date'} · {f.pilot}
                </small>
              </span>
              <span>{f.duration}</span>
            </button>
          ))}
          {!flights.length && <p>No linked flights.</p>}
        </section>
      )}
      {tab === 'Maintenance' && (
        <section className="glass passport-list">
          <h2>Work orders</h2>
          {services.map((s) => (
            <button
              key={s.id}
              className="linked-item"
              onClick={() => onOpen('service', s.id)}
            >
              <span>
                {s.task}
                <small>
                  {s.due} · {s.technician}
                  {s.cost != null && <> · {s.currency} {s.cost}</>}
                </small>
              </span>
              <Status>{s.status}</Status>
            </button>
          ))}
          {!services.length && <p>No work orders linked.</p>}
        </section>
      )}
      {tab === 'Inspections' && (
        <section className="glass passport-list">
          <h2>Inspection history</h2>
          {plans.map((p) => (
            <div key={p.id}>
              <h3>
                {p.profileSnapshot.name} · v{p.profileRevision}
              </h3>
              {events
                .filter((e) => e.planId === p.id)
                .map((e) => (
                  <article className="inspection-rule" key={e.id}>
                    <strong>
                      {e.action}:{' '}
                      {e.component ||
                        p.profileSnapshot.rules.find(
                          (r: any) => r.id === e.ruleId,
                        )?.name}
                    </strong>
                    <p>
                      {e.date} · {e.signedBy}
                    </p>
                    <p>{e.findings}</p>
                    {e.replacementSerial && (
                      <p>Replacement serial: {e.replacementSerial}</p>
                    )}
                  </article>
                ))}
            </div>
          ))}
          {!plans.length && <p>No inspection profiles assigned.</p>}
        </section>
      )}
      {tab === 'Attachments' && (
        <section className="glass passport-list">
          <h2>Equipment documents</h2>
          {files.map((f) => (
            <button
              className="linked-item"
              key={f.id}
              onClick={async () => {
                try {
                  const result = await api('files/' + f.id);
                  window.open(result.url, '_blank', 'noopener,noreferrer');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <span>
                {f.name}
                <small>
                  {Math.round(f.size / 1024)} KB · {f.uploadedBy}
                </small>
              </span>
              <span>Download ↗</span>
            </button>
          ))}
          {!files.length && <p>No attachments yet.</p>}
          {allowed && (
            <label className="field">
              {uploading ? 'Uploading…' : 'Attach document (up to 25 MB)'}
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                disabled={uploading}
                onChange={async (e) => {
                  const input = e.currentTarget,
                    file = input.files?.[0];
                  if (!file) return;
                  setError('');
                  setUploading(true);
                  try {
                    const body = new FormData();
                    body.append('file', file);
                    body.append('targetKind', kind);
                    body.append('targetId', record.id);
                    await api('equipment-files', { method: 'POST', body });
                    await app.refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setUploading(false);
                    input.value = '';
                  }
                }}
              />
            </label>
          )}
        </section>
      )}
      {battery && tab === 'Battery readings' && (
        <>
          <BatteryReadingLedger battery={record} />
          <section className="glass passport-list">
            <h2>Charge and usage events</h2>
            {app
              .items('battery_event')
              .filter((e) => e.battery === record.id)
              .map((e) => (
                <div className="linked-item" key={e.id}>
                  <span>
                    {e.flightId
                      ? 'Recorded flight usage'
                      : 'Completed charge cycle'}
                    <small>
                      {e.date} · {e.recordedBy}
                    </small>
                    <small>{e.notes}</small>
                  </span>
                  <span>
                    {e.cycles != null ? `${e.cycles} register cycles` : ''}
                    {e.health != null ? ` · ${e.health}% health` : ''}
                    {e.temp != null ? ` · ${e.temp}°C` : ''}
                  </span>
                </div>
              ))}
          </section>
        </>
      )}
      {battery && tab === 'Telemetry' && (
        <BatteryTelemetryHistory
          battery={record}
          inventory={app.items('battery')}
          flights={app.items('flight')}
          onFlight={(id) => onOpen('flight', id)}
        />
      )}
    </article>
  );
}
