'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { incidentSchema } from '@/lib/operations/incidents';
export default function IncidentManager({
  onOpen,
}: {
  onOpen: (kind: 'flight' | 'asset' | 'battery', id: string) => void;
}) {
  const app = useApp(),
    [draft, setDraft] = useState<any>(null),
    [selected, setSelected] = useState(''),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('Open'),
    [equipmentSearch, setEquipmentSearch] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const manager = ['admin', 'manager'].includes(app.profile.role),
    record = app.items('incident').find((i) => i.id === selected);
  const equipment = (['asset', 'battery'] as const).flatMap((kind) =>
    app
      .items(kind)
      .map((e) => ({ ...e, kind, label: e.name || e.sourceName || e.model })),
  );
  function edit(item?: any) {
    setDraft(
      item
        ? { ...item }
        : {
            id: 'INC-' + crypto.randomUUID(),
            title: '',
            occurredAt: new Date().toISOString(),
            severity: 'Low',
            status: 'Reported',
            flightId: '',
            projectId: '',
            siteId: '',
            personnelIds: [],
            equipment: [],
            narrative: '',
            damage: '',
            cause: '',
            resolution: '',
            actions: [],
          },
    );
    setRevision(
      item
        ? app.records.find(
            (r) => String(r.kind) === 'incident' && r.id === item.id,
          )?.revision || 0
        : 0,
    );
    setError('');
    setEquipmentSearch('');
  }
  const change = (key: string, value: any) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  async function save() {
    setSaving(true);
    setError('');
    try {
      const parsed = incidentSchema.safeParse(draft);
      if (!parsed.success)
        throw new Error(parsed.error.issues.map((i) => i.message).join('. '));
      const data = parsed.data;
      await api('incidents', {
        method: 'POST',
        body: JSON.stringify({ data, revision }),
      });
      await app.refresh();
      setSelected(data.id);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="glass operations-catalog incident-manager">
      <div className="row">
        <Input
          aria-label="Search incidents"
          placeholder="Search incidents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Incident status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {['Open', 'All', 'Reported', 'Investigating', 'Closed'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button onClick={() => edit()}>Report incident</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="inspection-form">
          <label className="field">
            Incident title
            <Input
              value={draft.title}
              onChange={(e) => change('title', e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Occurred at (UTC)
              <Input
                type="datetime-local"
                value={draft.occurredAt.slice(0, 16)}
                onChange={(e) =>
                  change(
                    'occurredAt',
                    e.target.value ? e.target.value + ':00Z' : '',
                  )
                }
              />
            </label>
            <label className="field">
              Severity
              <select
                value={draft.severity}
                onChange={(e) => change('severity', e.target.value)}
              >
                {['Low', 'Moderate', 'High', 'Critical'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            {manager && (
              <label className="field">
                Investigation status
                <select
                  value={draft.status}
                  onChange={(e) => change('status', e.target.value)}
                >
                  {['Reported', 'Investigating', 'Closed'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="form-grid">
            {(['flight', 'project', 'site'] as const).map((kind) => (
              <label className="field" key={kind}>
                Linked {kind}
                <select
                  value={draft[kind + 'Id']}
                  onChange={(e) => change(kind + 'Id', e.target.value)}
                >
                  <option value="">None</option>
                  {app.items(kind).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.mission || v.id}
                      {kind === 'flight' ? ' · ' + v.date : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <fieldset className="equipment-metadata-fields">
            <legend>Involved personnel</legend>
            {app.items('crew').map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={draft.personnelIds.includes(c.id)}
                  onChange={(e) =>
                    change(
                      'personnelIds',
                      e.target.checked
                        ? [...draft.personnelIds, c.id]
                        : draft.personnelIds.filter(
                            (id: string) => id !== c.id,
                          ),
                    )
                  }
                />{' '}
                {c.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="equipment-metadata-fields">
            <legend>Involved equipment</legend>
            <Input
              aria-label="Search involved equipment"
              placeholder="Search name or serial…"
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
            />
            <div className="incident-equipment-options">
              {equipment
                .filter(
                  (e) =>
                    draft.equipment.some(
                      (r: any) => r.id === e.id && r.kind === e.kind,
                    ) ||
                    [e.label, e.serial]
                      .join(' ')
                      .toLowerCase()
                      .includes(equipmentSearch.toLowerCase()),
                )
                .sort(
                  (a, b) =>
                    Number(
                      draft.equipment.some(
                        (r: any) => r.id === b.id && r.kind === b.kind,
                      ),
                    ) -
                    Number(
                      draft.equipment.some(
                        (r: any) => r.id === a.id && r.kind === a.kind,
                      ),
                    ),
                )
                .slice(0, Math.max(40, draft.equipment.length))
                .map((e) => (
                  <label key={e.kind + e.id}>
                    <input
                      type="checkbox"
                      checked={draft.equipment.some(
                        (r: any) => r.id === e.id && r.kind === e.kind,
                      )}
                      onChange={(v) =>
                        change(
                          'equipment',
                          v.target.checked
                            ? [...draft.equipment, { kind: e.kind, id: e.id }]
                            : draft.equipment.filter(
                                (r: any) => r.id !== e.id || r.kind !== e.kind,
                              ),
                        )
                      }
                    />{' '}
                    {e.label} · {e.serial || e.id}
                  </label>
                ))}
            </div>
            <small>
              Search to narrow the list. Selected items stay visible; up to 40
              matching items are shown.
            </small>
          </fieldset>
          {(['narrative', 'damage', 'cause', 'resolution'] as const).map(
            (k) => (
              <label className="field" key={k}>
                {
                  {
                    narrative: 'What happened',
                    damage: 'Damage / injury observations',
                    cause: 'Cause and contributing factors',
                    resolution: 'Resolution and lessons learned',
                  }[k]
                }
                <textarea
                  value={draft[k]}
                  onChange={(e) => change(k, e.target.value)}
                />
              </label>
            ),
          )}
          <h3>Follow-up actions</h3>
          {draft.actions.map((a: any, i: number) => {
            const update = (key: string, value: any) =>
              change(
                'actions',
                draft.actions.map((v: any, j: number) =>
                  i === j ? { ...v, [key]: value } : v,
                ),
              );
            return (
              <div className="inspection-rule" key={a.id}>
                <label className="field">
                  Action {i + 1}
                  <Input
                    value={a.task}
                    onChange={(e) => update('task', e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    Assigned member
                    <select
                      value={a.assignedTo}
                      onChange={(e) => update('assignedTo', e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {app.profiles
                        .filter((p) => p.active || p.id === a.assignedTo)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name}
                            {!p.active ? ' (inactive)' : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Due date
                    <Input
                      type="date"
                      value={a.due}
                      onChange={(e) => update('due', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={a.done}
                    onChange={(e) => update('done', e.target.checked)}
                  />{' '}
                  Completed
                </label>
                <label className="field">
                  Completion notes
                  <textarea
                    value={a.completionNotes}
                    onChange={(e) => update('completionNotes', e.target.value)}
                  />
                </label>
                <Button
                  variant="ghost"
                  onClick={() =>
                    change(
                      'actions',
                      draft.actions.filter((_: any, j: number) => i !== j),
                    )
                  }
                >
                  Remove action
                </Button>
              </div>
            );
          })}
          <Button
            variant="outline"
            onClick={() =>
              change('actions', [
                ...draft.actions,
                {
                  id: crypto.randomUUID(),
                  task: '',
                  assignedTo: '',
                  due: '',
                  done: false,
                  completionNotes: '',
                },
              ])
            }
          >
            Add follow-up action
          </Button>
          <p>
            Equipment condition is managed separately in its record. Closing an
            incident does not release aircraft or batteries for flight.
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
              {saving ? 'Saving…' : 'Save incident'}
            </Button>
          </div>
        </div>
      ) : record ? (
        <div className="inspection-form">
          <Button variant="outline" onClick={() => setSelected('')}>
            ← All incidents
          </Button>
          <span className="eyebrow">
            {record.severity} · {record.status}
          </span>
          <h2>{record.title}</h2>
          <p>
            {record.occurredAt} · Reported by {record.reportedBy}
          </p>
          {record.flightId && (
            <Button
              variant="outline"
              onClick={() => onOpen('flight', record.flightId)}
            >
              Open linked flight
            </Button>
          )}
          <p>
            Project:{' '}
            {app.items('project').find((p) => p.id === record.projectId)
              ?.name || 'None'}{' '}
            · Site:{' '}
            {app.items('site').find((s) => s.id === record.siteId)?.name ||
              'None'}
          </p>
          <p>
            Personnel:{' '}
            {record.personnelIds
              .map(
                (id: string) =>
                  app.items('crew').find((c) => c.id === id)?.name || id,
              )
              .join(', ') || 'None recorded'}
          </p>
          {record.equipment.map((r: any) => (
            <Button
              key={r.kind + r.id}
              variant="outline"
              onClick={() => onOpen(r.kind, r.id)}
            >
              {equipment.find((e) => e.kind === r.kind && e.id === r.id)
                ?.label || r.id}
            </Button>
          ))}
          {['narrative', 'damage', 'cause', 'resolution'].map((k) => (
            <div key={k}>
              <h3>
                {
                  {
                    narrative: 'What happened',
                    damage: 'Damage / injury observations',
                    cause: 'Cause and contributing factors',
                    resolution: 'Resolution',
                  }[k]
                }
              </h3>
              <p className="incident-narrative">
                {record[k] || 'Not recorded'}
              </p>
            </div>
          ))}
          <h3>Follow-up actions</h3>
          {record.actions.map((a: any) => (
            <article className="inspection-rule" key={a.id}>
              <strong>
                {a.done ? 'Completed' : 'Open'} · {a.task}
              </strong>
              <p>
                {app.profiles.find((p) => p.id === a.assignedTo)
                  ?.display_name || 'Unassigned'}{' '}
                · {a.due || 'No due date'}
              </p>
              <p>{a.completionNotes}</p>
              {a.completedAt && (
                <small>
                  Completed by {a.completedBy} · {a.completedAt}
                </small>
              )}
            </article>
          ))}
          {record.closedAt && (
            <p>
              Closed by {record.closedBy} · {record.closedAt}
            </p>
          )}
          {(manager ||
            (record.reportedById === app.profile.id &&
              record.status === 'Reported')) && (
            <Button onClick={() => edit(record)}>
              {record.status === 'Closed'
                ? 'Review / reopen incident'
                : 'Edit / investigate'}
            </Button>
          )}
          <h3>Evidence</h3>
          {app
            .items('attachment')
            .filter(
              (f) => f.targetKind === 'incident' && f.targetId === record.id,
            )
            .map((f) => (
              <Button
                key={f.id}
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await api('files/' + f.id);
                    window.open(result.url, '_blank', 'noopener,noreferrer');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {f.name} ↗
              </Button>
            ))}
          {record.status !== 'Closed' &&
            (manager || record.reportedById === app.profile.id) && (
              <label className="field">
                Attach evidence (up to 25 MB)
                <Input
                  type="file"
                  disabled={saving}
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                  onChange={async (e) => {
                    const input = e.currentTarget,
                      file = input.files?.[0];
                    if (!file) return;
                    setSaving(true);
                    setError('');
                    try {
                      const body = new FormData();
                      body.append('targetKind', 'incident');
                      body.append('targetId', record.id);
                      body.append('file', file);
                      await api('incident-files', { method: 'POST', body });
                      await app.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setSaving(false);
                      input.value = '';
                    }
                  }}
                />
              </label>
            )}
        </div>
      ) : (
        <div className="kit-grid">
          {app
            .items('incident')
            .filter(
              (i) =>
                (status === 'All' ||
                  (status === 'Open'
                    ? i.status !== 'Closed'
                    : i.status === status)) &&
                (i.title + ' ' + i.narrative)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
            .map((i) => (
              <button
                className="glass incident-card"
                key={i.id}
                onClick={() => setSelected(i.id)}
              >
                <span className="eyebrow">
                  {i.severity} · {i.status}
                </span>
                <h2>{i.title}</h2>
                <p>
                  {i.occurredAt.slice(0, 10)} · {i.reportedBy}
                </p>
                <p>
                  {i.actions.filter((a: any) => !a.done).length} open follow-up
                  actions
                </p>
              </button>
            ))}
          {!app.items('incident').length && <p>No incidents reported.</p>}
        </div>
      )}
    </section>
  );
}
