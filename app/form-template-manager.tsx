'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formTemplateSchema } from '@/lib/operations/forms';
export default function FormTemplateManager() {
  const app = useApp(),
    [draft, setDraft] = useState<any>(null),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const allowed = ['admin', 'manager'].includes(app.profile.role);
  const update = (key: string, value: any) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  function edit(t: any, clone = false) {
    setDraft(
      clone
        ? {
            ...t,
            id: 'FORM-' + crypto.randomUUID(),
            name: t.name + ' copy',
            archived: false,
          }
        : t,
    );
    setRevision(
      clone
        ? 0
        : app.records.find(
            (r) => String(r.kind) === 'form_template' && r.id === t.id,
          )?.revision || 0,
    );
    setError('');
  }
  async function save() {
    setSaving(true);
    setError('');
    try {
      const parsed = formTemplateSchema.safeParse(draft);
      if (!parsed.success)
        throw new Error(parsed.error.issues.map((i) => i.message).join('. '));
      const data = parsed.data;
      await api('form-templates', {
        method: 'POST',
        body: JSON.stringify({ data, revision }),
      });
      await app.refresh();
      setDraft(null);
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
          aria-label="Search templates"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {allowed && (
          <Button
            onClick={() =>
              edit({
                id: 'FORM-' + crypto.randomUUID(),
                name: '',
                type: 'Checklist',
                notes: '',
                archived: false,
                fields: [],
                hazards: [],
              })
            }
          >
            Create template
          </Button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="inspection-form">
          <label className="field">
            Template name
            <Input
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <label className="field">
            Template type
            <select
              value={draft.type}
              onChange={(e) => {
                update('type', e.target.value);
                update('fields', []);
                update('hazards', []);
              }}
            >
              <option>Checklist</option>
              <option>Custom form</option>
              <option>Risk assessment</option>
            </select>
          </label>
          <label className="field">
            Instructions
            <textarea
              value={draft.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </label>
          {draft.type === 'Risk assessment' ? (
            <>
              {draft.hazards.map((h: any, i: number) => (
                <div className="inspection-rule" key={i}>
                  <label className="field">
                    Hazard {i + 1}
                    <Input
                      value={h.hazard}
                      onChange={(e) =>
                        update(
                          'hazards',
                          draft.hazards.map((v: any, j: number) =>
                            j === i ? { ...v, hazard: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Suggested controls
                    <textarea
                      value={h.mitigation}
                      onChange={(e) =>
                        update(
                          'hazards',
                          draft.hazards.map((v: any, j: number) =>
                            j === i ? { ...v, mitigation: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="form-grid">
                    {['likelihood', 'severity'].map((k) => (
                      <label className="field" key={k}>
                        {k}
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={h[k]}
                          onChange={(e) =>
                            update(
                              'hazards',
                              draft.hazards.map((v: any, j: number) =>
                                j === i
                                  ? { ...v, [k]: Number(e.target.value) }
                                  : v,
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
                        'hazards',
                        draft.hazards.filter((_: any, j: number) => j !== i),
                      )
                    }
                  >
                    Remove hazard
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  update('hazards', [
                    ...draft.hazards,
                    { hazard: '', mitigation: '', likelihood: 1, severity: 1 },
                  ])
                }
              >
                Add hazard
              </Button>
            </>
          ) : (
            <>
              {draft.fields.map((f: any, i: number) => (
                <div className="inspection-rule" key={f.id}>
                  <label className="field">
                    Field {i + 1}
                    <Input
                      value={f.label}
                      onChange={(e) =>
                        update(
                          'fields',
                          draft.fields.map((v: any, j: number) =>
                            j === i ? { ...v, label: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  {draft.type === 'Custom form' && (
                    <label className="field">
                      Answer type
                      <select
                        value={f.type}
                        onChange={(e) =>
                          update(
                            'fields',
                            draft.fields.map((v: any, j: number) =>
                              j === i ? { ...v, type: e.target.value } : v,
                            ),
                          )
                        }
                      >
                        {['Check', 'Text', 'Number', 'Date', 'Choice'].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  {f.type === 'Choice' && (
                    <label className="field">
                      Options (one per line)
                      <textarea
                        value={f.options.join('\n')}
                        onChange={(e) =>
                          update(
                            'fields',
                            draft.fields.map((v: any, j: number) =>
                              j === i
                                ? { ...v, options: e.target.value.split('\n') }
                                : v,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) =>
                        update(
                          'fields',
                          draft.fields.map((v: any, j: number) =>
                            j === i ? { ...v, required: e.target.checked } : v,
                          ),
                        )
                      }
                    />{' '}
                    Required before submission
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update(
                        'fields',
                        draft.fields.filter((_: any, j: number) => j !== i),
                      )
                    }
                  >
                    Remove field
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  update('fields', [
                    ...draft.fields,
                    {
                      id: crypto.randomUUID(),
                      label: '',
                      type: draft.type === 'Checklist' ? 'Check' : 'Text',
                      required: true,
                      options: [],
                    },
                  ])
                }
              >
                Add field
              </Button>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(e) => update('archived', e.target.checked)}
            />{' '}
            Archive template
          </label>
          <p>
            Saving creates the next version. Existing mission forms retain the
            version they used.
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
              {saving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="kit-grid">
          {app
            .items('form_template')
            .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
            .map((t) => (
              <article className="glass" key={t.id}>
                <span className="eyebrow">
                  {t.type} · {t.archived ? 'Archived' : 'Active'}
                </span>
                <h2>{t.name}</h2>
                <p>{t.notes}</p>
                <p>
                  {t.type === 'Risk assessment'
                    ? t.hazards.length + ' hazards'
                    : t.fields.length + ' fields'}{' '}
                  · Version{' '}
                  {
                    app.records.find(
                      (r) =>
                        String(r.kind) === 'form_template' && r.id === t.id,
                    )?.revision
                  }
                </p>
                {allowed && (
                  <div className="row">
                    <Button variant="outline" onClick={() => edit(t)}>
                      Edit template
                    </Button>
                    <Button variant="outline" onClick={() => edit(t, true)}>
                      Duplicate
                    </Button>
                  </div>
                )}
              </article>
            ))}
          {!app.items('form_template').length && (
            <p>
              No templates yet. Create reusable checks, custom forms or risk
              starting points.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
