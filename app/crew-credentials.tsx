'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/supabase-browser';
import { qualificationState } from '@/lib/operations/qualifications';
import CrewCurrency from './crew-currency';
export default function CrewCredentials({
  person,
  onChange,
}: {
  person: any;
  onChange?: (key: string, value: any) => void;
}) {
  const app = useApp(),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false);
  const aircraft = app.items('asset').filter((a) => a.category === 'Aircraft'),
    qualifications = person.qualifications || [],
    ids = person.authorizedAircraftIds || [],
    policy = person.aircraftPermission || 'Not configured';
  const files = app
    .items('attachment')
    .filter((f) => f.targetKind === 'crew' && f.targetId === person.id);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: app.organization.settings?.timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return (
    <section className="crew-credentials">
      <CrewCurrency person={person} onChange={onChange} />
      <h3>Aircraft permissions</h3>
      {onChange ? (
        <>
          <label className="field">
            Authorization policy
            <select
              value={policy}
              onChange={(e) => onChange('aircraftPermission', e.target.value)}
            >
              {['Not configured', 'All aircraft', 'Selected aircraft'].map(
                (p) => (
                  <option key={p}>{p}</option>
                ),
              )}
            </select>
          </label>
          {policy === 'Selected aircraft' && (
            <>
              <Input
                aria-label="Search authorized aircraft"
                placeholder="Search aircraft…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="incident-equipment-options">
                {aircraft
                  .filter(
                    (a) =>
                      ids.includes(a.id) ||
                      a.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((a) => (
                    <label key={a.id}>
                      <input
                        type="checkbox"
                        checked={ids.includes(a.id)}
                        onChange={(e) =>
                          onChange(
                            'authorizedAircraftIds',
                            e.target.checked
                              ? [...ids, a.id]
                              : ids.filter((id: string) => id !== a.id),
                          )
                        }
                      />{' '}
                      {a.name} · {a.serial}
                    </label>
                  ))}
              </div>
            </>
          )}
          <p className="fine-print">
            Primary pilots, second pilots and instructors need explicit
            authorization for every aircraft in the mission. An empty selected
            list authorizes no aircraft.
          </p>
        </>
      ) : (
        <>
          <p>{policy}</p>
          {policy === 'Selected aircraft' && (
            <p>
              {ids
                .map(
                  (id: string) => aircraft.find((a) => a.id === id)?.name || id,
                )
                .join(', ') || 'No aircraft authorized'}
            </p>
          )}
        </>
      )}
      <h3>Qualifications and endorsements</h3>
      {qualifications.map((q: any, i: number) => {
        const change = (key: string, value: any) =>
          onChange?.(
            'qualifications',
            qualifications.map((v: any, j: number) =>
              i === j ? { ...v, [key]: value } : v,
            ),
          );
        return (
          <article className="inspection-rule" key={q.id}>
            {onChange ? (
              <>
                <label className="field">
                  Qualification name
                  <Input
                    value={q.name}
                    onChange={(e) => change('name', e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  {['issuer', 'reference', 'issued', 'expires'].map((k) => (
                    <label className="field" key={k}>
                      {
                        {
                          issuer: 'Issuer',
                          reference: 'Certificate number',
                          issued: 'Issue date',
                          expires: 'Expiry date',
                        }[k]
                      }
                      <Input
                        type={
                          ['issued', 'expires'].includes(k) ? 'date' : 'text'
                        }
                        value={q[k]}
                        onChange={(e) => change(k, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={q.requiredForOperations}
                    onChange={(e) =>
                      change('requiredForOperations', e.target.checked)
                    }
                  />{' '}
                  Required for this person's operations
                </label>
                <label className="field">
                  Evidence document
                  <select
                    value={q.evidenceId}
                    onChange={(e) => change('evidenceId', e.target.value)}
                  >
                    <option value="">No evidence selected</option>
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="ghost"
                  onClick={() =>
                    onChange(
                      'qualifications',
                      qualifications.filter((_: any, j: number) => i !== j),
                    )
                  }
                >
                  Remove qualification
                </Button>
              </>
            ) : (
              <>
                <strong>{q.name}</strong>
                <p>
                  {qualificationState(q, today)} ·{' '}
                  {q.requiredForOperations
                    ? 'Required for operations'
                    : 'Additional qualification'}
                </p>
                <p>
                  {q.issuer} · {q.reference}
                </p>
                <p>
                  {q.issued || 'Issue date not recorded'} → {q.expires}
                </p>
                {q.evidenceId && (
                  <p>
                    Evidence:{' '}
                    {files.find((f) => f.id === q.evidenceId)?.name ||
                      'Unavailable'}
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}
      {!qualifications.length && (
        <p>
          No additional qualifications recorded. The primary certificate remains
          checked separately.
        </p>
      )}
      {onChange && (
        <Button
          variant="outline"
          onClick={() =>
            onChange('qualifications', [
              ...qualifications,
              {
                id: crypto.randomUUID(),
                name: '',
                issuer: '',
                reference: '',
                issued: '',
                expires: '',
                requiredForOperations: true,
                evidenceId: '',
              },
            ])
          }
        >
          Add qualification
        </Button>
      )}
      {!onChange && (
        <>
          <h3>Personnel evidence</h3>
          {error && <p role="alert">{error}</p>}
          {files.map((f) => (
            <Button
              key={f.id}
              variant="outline"
              onClick={async () => {
                try {
                  const r = await api('files/' + f.id);
                  window.open(r.url, '_blank', 'noopener,noreferrer');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {f.name} ↗
            </Button>
          ))}
          {['admin', 'manager'].includes(app.profile.role) && (
            <label className="field">
              Upload qualification evidence (up to 25 MB)
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                disabled={uploading}
                onChange={async (e) => {
                  const input = e.currentTarget,
                    file = input.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError('');
                  try {
                    const body = new FormData();
                    body.append('file', file);
                    body.append('targetKind', 'crew');
                    body.append('targetId', person.id);
                    await api('crew-files', { method: 'POST', body });
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
        </>
      )}
      {onChange && (
        <p className="fine-print">
          Upload evidence from the saved crew profile, then link it here.
          Required qualifications block mission submission when expired, not yet
          valid or missing evidence.
        </p>
      )}
    </section>
  );
}
