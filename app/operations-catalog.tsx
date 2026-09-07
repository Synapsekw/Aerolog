'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MissionMap from './mission-map';
import { catalogSchemas, type CatalogKind } from '@/lib/operations/catalog';
export default function OperationsCatalog({
  kind,
  onMission,
}: {
  kind: CatalogKind;
  onMission: (id: string) => void;
}) {
  const app = useApp(),
    [draft, setDraft] = useState<any>(null),
    [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  const allowed = ['admin', 'manager'].includes(app.profile.role);
  const records = app
    .items(kind)
    .filter(
      (r) =>
        (archived || !r.archived) &&
        (r.name + ' ' + r.notes).toLowerCase().includes(search.toLowerCase()),
    );
  const update = (k: string, v: any) =>
    setDraft((d: any) => ({ ...d, [k]: v }));
  function create() {
    const common = {
      id: kind.toUpperCase() + '-' + crypto.randomUUID(),
      name: '',
      notes: '',
      archived: false,
    };
    setDraft({
      ...common,
      ...(kind === 'customer'
        ? { contactName: '', email: '', phone: '' }
        : kind === 'project'
          ? {
              customerId: '',
              reference: '',
              startDate: '',
              endDate: '',
              revenue: null,
              currency: 'AED',
            }
          : {
              purpose: 'Operating area',
              projectId: '',
              address: '',
              geometry: [],
            }),
    });
    setError('');
    setRevision(0);
  }
  async function save() {
    setError('');
    setSaving(true);
    try {
      const parsed = catalogSchemas[kind].safeParse(draft);
      if (!parsed.success)
        throw Error(parsed.error.issues.map((i) => i.message).join('. '));
      await api('catalog', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          data: parsed.data,
          revision,
        }),
      });
      await app.refresh();
      setDraft(null);
      setPage(1);
      app.notify('Record saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="glass operations-catalog">
      <div className="row">
        <Input
          aria-label={`Search ${kind}s`}
          placeholder={`Search ${kind}s…`}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(1);
            }}
          />{' '}
          Include archived
        </label>
        {allowed && <Button onClick={create}>Create {kind}</Button>}
      </div>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="inspection-form">
          <label className="field">
            Name
            <Input
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          {kind === 'customer' &&
            ['contactName', 'email', 'phone'].map((k) => (
              <label className="field" key={k}>
                {k === 'contactName' ? 'Contact name' : k}
                <Input
                  value={draft[k]}
                  onChange={(e) => update(k, e.target.value)}
                />
              </label>
            ))}
          {kind === 'project' && (
            <>
              <label className="field">
                Customer
                <select
                  value={draft.customerId}
                  onChange={(e) => update('customerId', e.target.value)}
                >
                  <option value="">No customer</option>
                  {app.items('customer').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? ' (archived)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Project reference
                <Input
                  value={draft.reference}
                  onChange={(e) => update('reference', e.target.value)}
                />
              </label>
              <div className="form-grid">
                {['startDate', 'endDate'].map((k) => (
                  <label className="field" key={k}>
                    {k === 'startDate' ? 'Start date' : 'End date'}
                    <Input
                      type="date"
                      value={draft[k]}
                      onChange={(e) => update(k, e.target.value)}
                    />
                  </label>
                ))}
                <label className="field">
                  Contract revenue
                  <Input
                    type="number"
                    min="0"
                    value={draft.revenue ?? ''}
                    onChange={(e) =>
                      update(
                        'revenue',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="field">
                  Currency (3-letter code)
                  <Input
                    maxLength={3}
                    value={draft.currency}
                    onChange={(e) =>
                      update('currency', e.target.value.toUpperCase())
                    }
                  />
                </label>
              </div>
            </>
          )}
          {kind === 'site' && (
            <>
              <label className="field">
                Purpose
                <select
                  value={draft.purpose}
                  onChange={(e) => update('purpose', e.target.value)}
                >
                  {['Operating area', 'Storage', 'Both'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Project
                <select
                  value={draft.projectId}
                  onChange={(e) => update('projectId', e.target.value)}
                >
                  <option value="">Shared organization site</option>
                  {app.items('project').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Address
                <Input
                  value={draft.address}
                  onChange={(e) => update('address', e.target.value)}
                />
              </label>
              <MissionMap
                points={draft.geometry}
                onChange={(p) => update('geometry', p)}
                height={360}
              />
              <p>
                Click the map to record a point or define a boundary. Storage
                sites are separate from flight observations.
              </p>
            </>
          )}
          <label className="field">
            Notes
            <textarea
              value={draft.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(e) => update('archived', e.target.checked)}
            />{' '}
            Archive record
          </label>
          <div className="row">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="kit-grid">
          {records.slice((page - 1) * 12, page * 12).map((r) => {
            const missions = app
              .items('mission')
              .filter((m) =>
                kind === 'project'
                  ? m.projectId === r.id
                  : kind === 'site'
                    ? m.siteId === r.id
                    : app
                        .items('project')
                        .some(
                          (p) => p.customerId === r.id && m.projectId === p.id,
                        ),
              );
            const flights = app
              .items('flight')
              .filter((f) => missions.some((m) => m.id === f.missionId));
            return (
              <article className="glass" key={r.id}>
                <h2>{r.name}</h2>
                <p>
                  {r.archived
                    ? 'Archived'
                    : kind === 'site'
                      ? r.purpose
                      : 'Active'}
                </p>
                {kind === 'customer' && (
                  <p>
                    {r.contactName} · {r.email}
                  </p>
                )}
                {kind === 'project' && (
                  <>
                    <p>
                      {app.items('customer').find((c) => c.id === r.customerId)
                        ?.name || 'No customer'}{' '}
                      · {r.reference}
                    </p>
                    <p>
                      {r.startDate || 'No start date'} —{' '}
                      {r.endDate || 'No end date'}
                    </p>
                    {r.revenue != null && (
                      <p>
                        Contract revenue {r.revenue.toLocaleString()}{' '}
                        {r.currency}
                      </p>
                    )}
                  </>
                )}
                {kind === 'site' && (
                  <>
                    <p>{r.address}</p>
                    {r.geometry.length > 0 && (
                      <MissionMap points={r.geometry} height={220} />
                    )}
                  </>
                )}
                <p>{r.notes}</p>
                <p>
                  {missions.length} linked missions · {flights.length} linked
                  flights
                </p>
                {missions.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    className="linked-item"
                    onClick={() => onMission(m.id)}
                  >
                    {m.name}
                    <span>{m.status}</span>
                  </button>
                ))}
                {allowed && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft(r);
                      setRevision(
                        app.records.find(
                          (row) => String(row.kind) === kind && row.id === r.id,
                        )?.revision || 0,
                      );
                      setError('');
                    }}
                  >
                    Edit {kind}
                  </Button>
                )}
              </article>
            );
          })}
          {!records.length && (
            <p>
              No matching {kind}s. Create one to start organizing operations.
            </p>
          )}
        </div>
      )}
      {!draft && records.length > 12 && (
        <div className="row">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(records.length / 12)}
          </span>
          <Button
            variant="outline"
            disabled={page * 12 >= records.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
