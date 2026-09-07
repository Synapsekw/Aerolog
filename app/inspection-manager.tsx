'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  inspectionDue,
  inspectionMeters,
  type InspectionProfile,
  type InspectionPlan,
  type InspectionEvent,
} from '@/lib/operations/inspections';
const blank = () => ({ hours: null, flights: null, cycles: null });
export default function InspectionManager({ today }: { today: string }) {
  const app = useApp(),
    profiles = app.items('inspection_profile') as InspectionProfile[],
    plans = app.items('inspection_plan') as InspectionPlan[],
    events = app.items('inspection_event') as InspectionEvent[];
  const [draft, setDraft] = useState<any>(null),
    [kind, setKind] = useState('inspection_profile'),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [tab, setTab] = useState('Readiness');
  const editable = ['admin', 'manager', 'technician'].includes(
      app.profile.role,
    ),
    equipment = [
      ...app.items('asset').map((a) => ({ ...a, kind: 'asset' })),
      ...app
        .items('battery')
        .map((b) => ({ ...b, name: b.sourceName || b.model, kind: 'battery' })),
    ];
  const update = (k: string, v: any) =>
    setDraft((d: any) => ({ ...d, [k]: v }));
  function edit(k: string, d: any) {
    setKind(k);
    setDraft(d);
    setError('');
  }
  async function save() {
    setSaving(true);
    setError('');
    try {
      await api('inspections', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          data: draft,
          revision:
            app.records.find(
              (r) => String(r.kind) === kind && r.id === draft.id,
            )?.revision || 0,
        }),
      });
      await app.refresh();
      setDraft(null);
      app.notify('Inspection record saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const current = (plan: InspectionPlan) =>
    inspectionMeters(
      plan,
      equipment,
      app.items('flight'),
      app.inspectionMeterRoutes,
      app.equipmentAliases,
    );
  return (
    <section className="glass inspection-manager">
      <div className="row">
        <div>
          <span className="eyebrow">INSPECTIONS & COMPONENT LIFE</span>
          <h2>Maintenance profiles</h2>
          <p>
            Every applicable limit must be known. Reaching any limit makes an
            inspection due.
          </p>
        </div>
        {editable && (
          <div className="calendar-actions">
            <Button
              variant="outline"
              onClick={() =>
                edit('inspection_profile', {
                  id: 'IP-' + crypto.randomUUID(),
                  name: '',
                  model: '',
                  archived: false,
                  rules: [
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      component: '',
                      action: 'Inspect',
                      hours: null,
                      flights: null,
                      cycles: null,
                      days: null,
                    },
                  ],
                })
              }
            >
              Create profile
            </Button>
            <Button
              disabled={!profiles.some((p) => !p.archived)}
              onClick={() =>
                edit('inspection_plan', {
                  id: 'PLAN-' + crypto.randomUUID(),
                  profileId: profiles.find((p) => !p.archived)?.id || '',
                  targetKind: 'asset',
                  targetId: '',
                  baselineDate: today,
                  baseline: blank(),
                })
              }
            >
              Assign profile
            </Button>
          </div>
        )}
      </div>
      <div className="calendar-actions">
        {['Readiness', 'Profiles', 'Signed history'].map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="inspection-form">
          {kind === 'inspection_profile' ? (
            <>
              <label className="field">
                Profile name
                <Input
                  value={draft.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </label>
              <label className="field">
                Model / family
                <Input
                  value={draft.model}
                  onChange={(e) => update('model', e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.archived}
                  onChange={(e) => update('archived', e.target.checked)}
                />{' '}
                Archive profile
              </label>
              <p>
                Existing assignments retain this version. Changing these rules
                applies to future assignments.
              </p>
              {draft.rules.map((r: any, i: number) => (
                <div className="inspection-rule" key={r.id}>
                  <label className="field">
                    Inspection task
                    <Input
                      value={r.name}
                      onChange={(e) =>
                        update(
                          'rules',
                          draft.rules.map((x: any, n: number) =>
                            n === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Component
                    <Input
                      value={r.component}
                      onChange={(e) =>
                        update(
                          'rules',
                          draft.rules.map((x: any, n: number) =>
                            n === i ? { ...x, component: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Action
                    <select
                      value={r.action}
                      onChange={(e) =>
                        update(
                          'rules',
                          draft.rules.map((x: any, n: number) =>
                            n === i ? { ...x, action: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      <option>Inspect</option>
                      <option>Replace</option>
                    </select>
                  </label>
                  <div className="inspection-meters">
                    {['hours', 'flights', 'cycles', 'days'].map((k) => (
                      <label className="field" key={k}>
                        Every {k}
                        <Input
                          type="number"
                          min="1"
                          placeholder="Not applicable"
                          value={r[k] ?? ''}
                          onChange={(e) =>
                            update(
                              'rules',
                              draft.rules.map((x: any, n: number) =>
                                n === i
                                  ? {
                                      ...x,
                                      [k]:
                                        e.target.value === ''
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update(
                        'rules',
                        draft.rules.filter((_: any, n: number) => n !== i),
                      )
                    }
                  >
                    Remove rule
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  update('rules', [
                    ...draft.rules,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      component: '',
                      action: 'Inspect',
                      hours: null,
                      flights: null,
                      cycles: null,
                      days: null,
                    },
                  ])
                }
              >
                Add interval rule
              </Button>
            </>
          ) : kind === 'inspection_plan' ? (
            <>
              <label className="field">
                Profile
                <select
                  value={draft.profileId}
                  onChange={(e) => update('profileId', e.target.value)}
                >
                  {profiles
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.model}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Equipment
                <select
                  value={draft.targetKind + ':' + draft.targetId}
                  onChange={(e) => {
                    const [targetKind, ...rest] = e.target.value.split(':');
                    const targetId = rest.join(':');
                    const eq = equipment.find(
                      (x) => x.kind === targetKind && x.id === targetId,
                    );
                    setDraft({
                      ...draft,
                      targetKind,
                      targetId,
                      baseline: {
                        hours: eq?.hours ?? null,
                        cycles: eq?.cycles ?? null,
                        flights: null,
                      },
                    });
                  }}
                >
                  <option value="asset:">Select equipment…</option>
                  {equipment.map((e) => (
                    <option key={e.kind + e.id} value={e.kind + ':' + e.id}>
                      {e.name} · {e.serial || e.id}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Baseline effective {today}. Confirm current lifetime counters.
                Leave unknown values empty. The profile starts from this
                baseline; it does not certify prior maintenance.
              </p>
            </>
          ) : (
            <>
              <p>
                Sign inspection for{' '}
                {plans.find((p) => p.id === draft.planId)?.profileSnapshot.name}
              </p>
              <label className="field">
                Performed date
                <Input
                  type="date"
                  max={today}
                  value={draft.date}
                  onChange={(e) => update('date', e.target.value)}
                />
              </label>
              <label className="field">
                Findings / work performed
                <textarea
                  value={draft.findings}
                  onChange={(e) => update('findings', e.target.value)}
                />
              </label>
              <label className="field">
                Replacement serial (if applicable)
                <Input
                  value={draft.replacementSerial}
                  onChange={(e) => update('replacementSerial', e.target.value)}
                />
              </label>
              <p>Signing creates an immutable event under your name.</p>
            </>
          )}
          {kind !== 'inspection_profile' && (
            <div className="inspection-meters">
              {['hours', 'flights', 'cycles'].map((k) => (
                <label className="field" key={k}>
                  Lifetime {k}
                  <Input
                    type="number"
                    min="0"
                    placeholder="Unknown"
                    value={(draft.baseline || draft.meters)[k] ?? ''}
                    onChange={(e) => {
                      const key =
                        kind === 'inspection_plan' ? 'baseline' : 'meters';
                      update(key, {
                        ...draft[key],
                        [k]:
                          e.target.value === '' ? null : Number(e.target.value),
                      });
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="row">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving
                ? 'Saving…'
                : kind === 'inspection_event'
                  ? 'Sign inspection'
                  : 'Save'}
            </Button>
          </div>
        </div>
      ) : tab === 'Profiles' ? (
        <div className="kit-grid">
          {profiles.map((p) => (
            <article className="glass" key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.model} · {p.rules.length} rules{' '}
                {p.archived ? '· Archived' : ''}
              </p>
              {p.rules.map((r) => (
                <p key={r.id}>
                  {r.action}: {r.name} ·{' '}
                  {['hours', 'flights', 'cycles', 'days']
                    .filter((k) => (r as any)[k] != null)
                    .map((k) => `${(r as any)[k]} ${k}`)
                    .join(' / ')}
                </p>
              ))}
              {editable && (
                <Button
                  variant="outline"
                  onClick={() => edit('inspection_profile', p)}
                >
                  Edit profile
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : tab === 'Signed history' ? (
        <div>
          {events
            .slice()
            .reverse()
            .map((e) => (
              <article className="inspection-rule" key={e.id}>
                <h3>
                  {plans
                    .find((p) => p.id === e.planId)
                    ?.profileSnapshot.rules.find((r) => r.id === e.ruleId)
                    ?.name || e.ruleId}
                </h3>
                <p>
                  {e.date} · Signed by {e.signedBy}
                </p>
                <p>{e.findings}</p>
                {e.replacementSerial && (
                  <p>Replacement: {e.replacementSerial}</p>
                )}
              </article>
            ))}
          {!events.length && <p>No signed inspections yet.</p>}
        </div>
      ) : (
        <div className="kit-grid">
          {plans.map((p) => (
            <article className="glass" key={p.id}>
              <h3>
                {equipment.find(
                  (e) => e.kind === p.targetKind && e.id === p.targetId,
                )?.name || p.targetId}
              </h3>
              <p>
                {p.profileSnapshot.name} · version {p.profileRevision}
              </p>
              {(app.inspectionMeterRoutes || [])
                .filter((route) => route.plan_id === p.id)
                .map((route) => (
                  <p className="fine-print" key={route.plan_id}>
                    Usage continues from{' '}
                    {equipment.find(
                      (e) =>
                        e.kind === route.target_kind &&
                        e.id === route.target_id,
                    )?.name || route.target_id}
                    . Inspection readings retain the original meter scale:{' '}
                    {current(p).hours ?? 'Unknown'} hours ·{' '}
                    {current(p).cycles ?? 'Unknown'} cycles ·{' '}
                    {current(p).flights ?? 'Unknown'} flights. These can differ
                    from the consolidated equipment register.
                  </p>
                ))}
              {inspectionDue(p, events, current(p), today).map((d) => (
                <div className="inspection-rule" key={d.rule.id}>
                  <strong>
                    {d.rule.action}: {d.rule.name}
                  </strong>
                  <p>{d.status}</p>
                  <p>
                    {d.limits
                      .map((l) =>
                        l.remaining == null
                          ? `${l.unit}: unknown`
                          : `${Math.round(l.remaining * 10) / 10} ${l.unit} remaining`,
                      )
                      .join(' · ')}
                  </p>
                  {editable && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        edit('inspection_event', {
                          id: 'INSP-' + crypto.randomUUID(),
                          planId: p.id,
                          ruleId: d.rule.id,
                          date: today,
                          meters: current(p),
                          findings: '',
                          replacementSerial: '',
                        })
                      }
                    >
                      Record {d.rule.action.toLowerCase()}
                    </Button>
                  )}
                </div>
              ))}
            </article>
          ))}
          {!plans.length && (
            <p>
              No inspection profiles assigned. Create a model profile, then
              attach it to an aircraft or battery.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
