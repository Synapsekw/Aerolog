'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { api } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { documentSchema } from '@/lib/operations/documents';
export default function DocumentRegister() {
  const app = useApp(),
    [selected, setSelected] = useState(''),
    [draft, setDraft] = useState<any>(null),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reviewNote, setReviewNote] = useState('');
  const manager = ['admin', 'manager'].includes(app.profile.role),
    record = app.items('document').find((d) => d.id === selected),
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: app.organization.settings?.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const rev = (id: string) =>
    app.records.find((r) => String(r.kind) === 'document' && r.id === id)
      ?.revision || 0;
  function edit(d?: any) {
    setDraft(
      d || {
        id: 'DOC-' + crypto.randomUUID(),
        name: '',
        category: 'Permit',
        targetKind: 'Organization',
        targetId: '',
        validFrom: '',
        expires: '',
        attachmentId: '',
        notes: '',
        archived: false,
      },
    );
    setRevision(d ? rev(d.id) : 0);
    setError('');
  }
  const update = (k: string, v: any) =>
    setDraft((d: any) => ({ ...d, [k]: v }));
  async function save(submit: boolean) {
    setBusy(true);
    setError('');
    try {
      const p = documentSchema.safeParse(draft);
      if (!p.success)
        throw Error(p.error.issues.map((i) => i.message).join('. '));
      await api('documents', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          data: p.data,
          revision,
          submit,
        }),
      });
      await app.refresh();
      setSelected(draft.id);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    try {
      const result = await api('files/' + id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="glass operations-catalog">
      <div className="row">
        <Input
          aria-label="Search documents"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Document status filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            'All',
            'Draft',
            'Pending approval',
            'Approved',
            'Rejected',
            'Expired',
            'Archived',
          ].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {manager && <Button onClick={() => edit()}>Create document</Button>}
      </div>
      {error && <p role="alert">{error}</p>}
      {draft ? (
        <div className="inspection-form">
          <label className="field">
            Document name
            <Input
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Category
              <select
                value={draft.category}
                onChange={(e) => update('category', e.target.value)}
              >
                {['Permit', 'Insurance', 'SOP', 'Qualification', 'Other'].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              Applies to
              <select
                value={draft.targetKind}
                onChange={(e) => {
                  update('targetKind', e.target.value);
                  update('targetId', '');
                }}
              >
                {[
                  'Organization',
                  'crew',
                  'asset',
                  'battery',
                  'project',
                  'mission',
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {draft.targetKind !== 'Organization' && (
            <label className="field">
              Linked record
              <select
                value={draft.targetId}
                onChange={(e) => update('targetId', e.target.value)}
              >
                <option value="">Select record</option>
                {app.items(draft.targetKind).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.sourceName || r.model || r.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            {['validFrom', 'expires'].map((k) => (
              <label className="field" key={k}>
                {k === 'expires'
                  ? 'Expiry date (optional)'
                  : 'Valid from (optional)'}
                <Input
                  type="date"
                  value={draft[k]}
                  onChange={(e) => update(k, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="field">
            Document file
            <select
              value={draft.attachmentId}
              onChange={(e) => update('attachmentId', e.target.value)}
            >
              <option value="">Select uploaded file</option>
              {app
                .items('attachment')
                .filter(
                  (f) => f.targetKind === 'document' && f.targetId === draft.id,
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Save a draft first, upload its file from the document detail, then
            select that file and submit for review.
          </p>
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
            Archived
          </label>
          <p>
            Saving a change creates a new version and requires a fresh approval.
          </p>
          <div className="row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save(false)}
            >
              Save draft
            </Button>
            <Button
              disabled={busy || !draft.attachmentId || draft.archived}
              onClick={() => void save(true)}
            >
              Submit document
            </Button>
          </div>
        </div>
      ) : record ? (
        <div className="inspection-form">
          <Button variant="outline" onClick={() => setSelected('')}>
            ← All documents
          </Button>
          <h2>{record.name}</h2>
          <p>
            {record.category} · {record.status} · Version {rev(record.id)}
            {record.archived ? ' · Archived' : ''}
          </p>
          <p>
            {record.validFrom || 'No start date'} →{' '}
            {record.expires || 'No expiry date'}
            {record.expires && record.expires < today ? ' · Expired' : ''}
          </p>
          <p>{record.notes}</p>
          {record.attachmentId && (
            <Button
              variant="outline"
              onClick={() => void download(record.attachmentId)}
            >
              Download current file
            </Button>
          )}
          {manager && (
            <>
              <Button onClick={() => edit(record)}>
                Edit / create new version
              </Button>
              <label className="field">
                Upload a file (up to 25 MB)
                <Input
                  type="file"
                  disabled={busy}
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                  onChange={async (e) => {
                    const input = e.currentTarget,
                      file = input.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setError('');
                    try {
                      const body = new FormData();
                      body.append('file', file);
                      body.append('targetKind', 'document');
                      body.append('targetId', record.id);
                      await api('document-files', { method: 'POST', body });
                      await app.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                      input.value = '';
                    }
                  }}
                />
              </label>
            </>
          )}
          {manager && record.status === 'Pending approval' && (
            <div className="inspection-rule">
              <label className="field">
                Review note
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </label>
              <div className="row">
                {['Approved', 'Rejected'].map((decision) => (
                  <Button
                    key={decision}
                    variant={decision === 'Approved' ? 'default' : 'outline'}
                    disabled={busy || reviewNote.trim().length < 5}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await api('documents', {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'review',
                            id: record.id,
                            revision: rev(record.id),
                            decision,
                            note: reviewNote,
                          }),
                        });
                        await app.refresh();
                        setReviewNote('');
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {decision === 'Approved'
                      ? 'Approve document'
                      : 'Reject document'}
                  </Button>
                ))}
              </div>
              <p>Workspace self-approval policy applies to document reviews.</p>
            </div>
          )}
          {record.reviewedAt && (
            <p>
              {record.reviewedBy} · {record.reviewedAt} · {record.reviewNote}
            </p>
          )}
          <h3>Version history</h3>
          {app
            .items('document_revision')
            .filter((v) => v.documentId === record.id)
            .sort((a, b) => b.revision - a.revision)
            .map((v) => (
              <article className="inspection-rule" key={v.revision}>
                <strong>
                  Version {v.revision} · {v.status}
                </strong>
                <p>
                  {v.name} · {v.recordedBy} · {v.recordedAt}
                </p>
                <p>
                  {v.validFrom || 'No start'} → {v.expires || 'No expiry'}
                </p>
                {v.attachmentId && (
                  <Button
                    variant="outline"
                    onClick={() => void download(v.attachmentId)}
                  >
                    Download this version's file
                  </Button>
                )}
              </article>
            ))}
        </div>
      ) : (
        <div className="kit-grid">
          {app
            .items('document')
            .filter(
              (d) =>
                d.name.toLowerCase().includes(search.toLowerCase()) &&
                (filter === 'All'
                  ? !d.archived
                  : filter === 'Expired'
                    ? d.expires && d.expires < today
                    : filter === 'Archived'
                      ? d.archived
                      : d.status === filter),
            )
            .map((d) => (
              <button
                className="glass incident-card"
                key={d.id}
                onClick={() => {
                  setSelected(d.id);
                  setError('');
                }}
              >
                <span className="eyebrow">
                  {d.category} · {d.status}
                </span>
                <h2>{d.name}</h2>
                <p>{d.expires ? 'Expires ' + d.expires : 'No expiry date'}</p>
                <p>
                  {d.targetKind}
                  {d.archived ? ' · Archived' : ''}
                </p>
              </button>
            ))}
          {!app.items('document').length && <p>No registered documents yet.</p>}
        </div>
      )}
    </section>
  );
}
