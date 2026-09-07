'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/supabase-browser';
export default function MissionDocuments({
  mission,
  onChange,
}: {
  mission: any;
  onChange?: (patch: any) => void;
}) {
  const app = useApp(),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  const choices = mission.documentSelections || [],
    snapshots = mission.documentSnapshots || [];
  return (
    <section className="mission-forms">
      <h3>Registered documents</h3>
      {error && <p role="alert">{error}</p>}
      {onChange && (
        <div className="row">
          <select
            aria-label="Registered document"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a document</option>
            {app
              .items('document')
              .filter(
                (d) => !d.archived && !choices.some((c: any) => c.id === d.id),
              )
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.status}
                </option>
              ))}
          </select>
          <Button
            variant="outline"
            disabled={!selected}
            onClick={() => {
              const d = app.items('document').find((d) => d.id === selected),
                revision = app.records.find(
                  (r) => String(r.kind) === 'document' && r.id === selected,
                )?.revision;
              onChange({
                documentSelections: [...choices, { id: selected, revision }],
                documentSnapshots: [...snapshots, { ...d, revision }],
              });
              setSelected('');
            }}
          >
            Attach document
          </Button>
        </div>
      )}
      {snapshots.map((d: any) => (
        <article className="inspection-rule" key={d.id}>
          <strong>
            {d.name} · v{d.revision}
          </strong>
          <p>
            {d.status} · {d.expires ? 'Expires ' + d.expires : 'No expiry date'}
          </p>
          {d.attachmentId && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const result = await api('files/' + d.attachmentId);
                  window.open(result.url, '_blank', 'noopener,noreferrer');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Download package document
            </Button>
          )}
          {onChange && (
            <Button
              variant="ghost"
              onClick={() =>
                onChange({
                  documentSelections: choices.filter((c: any) => c.id !== d.id),
                  documentSnapshots: snapshots.filter(
                    (c: any) => c.id !== d.id,
                  ),
                })
              }
            >
              Remove document
            </Button>
          )}
        </article>
      ))}
      {!choices.length && <p>No registered documents selected.</p>}
      {onChange && (
        <p>
          Selected documents must be approved and valid on the mission date
          before submission. The submitted package retains the reviewed file
          version.
        </p>
      )}
    </section>
  );
}
