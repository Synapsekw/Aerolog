'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { kitContents, kitSchema, type Kit } from '@/lib/operations/kits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Status } from './shared';
export default function KitBrowser() {
  const app = useApp(),
    [draft, setDraft] = useState<Kit | null>(null),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [archived, setArchived] = useState(false);
  const assets = app.items('asset'),
    batteries = app.items('battery'),
    kits = app.items('kit') as Kit[];
  const allowed = ['admin', 'manager', 'technician'].includes(app.profile.role);
  const candidates = [
    ...app.canonicalItems('asset').map((a) => ({
      kind: 'asset' as const,
      id: a.id,
      name: a.name,
      status: a.status,
    })),
    ...app.canonicalItems('battery').map((b) => ({
      kind: 'battery' as const,
      id: b.id,
      name: b.sourceName || b.model,
      status: b.status,
    })),
  ].filter((i) =>
    (i.name + ' ' + i.id).toLowerCase().includes(search.toLowerCase()),
  );
  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const data = kitSchema.parse(draft);
      await api('kits', {
        method: 'POST',
        body: JSON.stringify({
          data,
          revision:
            app.records.find(
              (r) => r.kind === ('kit' as any) && r.id === data.id,
            )?.revision || 0,
        }),
      });
      await app.refresh();
      setDraft(null);
      app.notify(
        'Kit saved. Existing mission packages retain their equipment.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="glass kit-browser">
      <div className="row">
        <div>
          <span className="eyebrow">REUSABLE EQUIPMENT</span>
          <h2>Mission kits</h2>
          <p>
            Keep aircraft, batteries and payloads together for mission
            preparation.
          </p>
        </div>
        {allowed && (
          <Button
            onClick={() => {
              setDraft({
                id: 'KIT-' + crypto.randomUUID(),
                name: '',
                items: [],
                notes: '',
                archived: false,
              });
              setSearch('');
              setError('');
            }}
          >
            Create kit
          </Button>
        )}
      </div>
      <label>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />{' '}
        Show archived kits
      </label>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="kit-editor">
          <label className="field">
            Kit name
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field">
            Notes
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(e) =>
                setDraft({ ...draft, archived: e.target.checked })
              }
            />{' '}
            Archive kit
          </label>
          <h3>Selected equipment ({draft.items.length})</h3>
          {kitContents(draft, assets, batteries).map((i) => (
            <div className="row" key={i.kind + i.id}>
              <span>{i.name}</span>
              <Status>{i.status}</Status>
              <Button
                variant="ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    items: draft.items.filter(
                      (x) => x.kind !== i.kind || x.id !== i.id,
                    ),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Input
            aria-label="Find kit equipment"
            placeholder="Search equipment name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="kit-candidates">
            {candidates.slice(0, 50).map((i) => (
              <label key={i.kind + i.id}>
                <input
                  type="checkbox"
                  checked={draft.items.some(
                    (x) => x.kind === i.kind && x.id === i.id,
                  )}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      items: e.target.checked
                        ? [...draft.items, { kind: i.kind, id: i.id }]
                        : draft.items.filter(
                            (x) => x.kind !== i.kind || x.id !== i.id,
                          ),
                    })
                  }
                />
                <span>
                  {i.name}
                  <small>
                    {i.kind} · {i.id} · {i.status}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p>
            Showing up to 50 matching items. Search to narrow the inventory.
          </p>
          <div className="row">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || !draft.name.trim() || !draft.items.length}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save kit'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="kit-grid">
          {kits
            .filter((k) => archived || !k.archived)
            .map((k) => {
              const contents = kitContents(k, assets, batteries);
              return (
                <article className="glass" key={k.id}>
                  <h3>{k.name}</h3>
                  <p>{k.notes}</p>
                  <p>
                    {contents.length} items ·{' '}
                    {contents.filter((i) => !i.ready).length} need readiness
                    review{k.archived ? ' · Archived' : ''}
                  </p>
                  {contents.map((i) => (
                    <p key={i.kind + i.id}>
                      {i.name} · {i.status}
                    </p>
                  ))}
                  {allowed && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft(k);
                        setSearch('');
                        setError('');
                      }}
                    >
                      Edit kit
                    </Button>
                  )}
                </article>
              );
            })}
          {!kits.length && (
            <p>No kits yet. Create a reusable equipment set to start.</p>
          )}
        </div>
      )}
    </section>
  );
}
