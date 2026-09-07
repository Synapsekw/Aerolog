'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { equipmentMergeReview } from '@/lib/operations/equipment-merge-review';
import {
  reconcileEquipmentCounter,
  type CounterDecision,
} from '@/lib/operations/equipment-merge-reconciliation';
import { api } from '@/lib/supabase-browser';
export default function EquipmentMergeReview() {
  const [counterSource, setCounterSource] = useState<
      CounterDecision['source'] | ''
    >(''),
    [counterReason, setCounterReason] = useState(''),
    [counterPreview, setCounterPreview] = useState<ReturnType<
      typeof reconcileEquipmentCounter
    > | null>(null);
  const resetCounter = () => {
    setCounterSource('');
    setCounterReason('');
    setCounterPreview(null);
  };
  const app = useApp(),
    [kind, setKind] = useState<'asset' | 'battery'>('asset'),
    [keep, setKeep] = useState(''),
    [duplicate, setDuplicate] = useState(''),
    [review, setReview] = useState<
      | (ReturnType<typeof equipmentMergeReview> & {
          reportReferences: any[];
          shareReferences: any[];
          capturedAt: string;
          reviewHash: string;
        })
      | null
    >(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!['admin', 'manager'].includes(app.profile.role)) return null;
  const items = app.records.filter((r) => r.kind === kind);
  return (
    <details className="glass equipment-bulk-editor">
      <summary>Review possible inventory duplicates</summary>
      <p>
        Compare identities, counters and linked records before consolidation.
        This review does not merge or delete equipment; applying a merge is not
        available yet.
      </p>
      <div className="form-grid">
        <label className="field">
          Equipment kind
          <select
            disabled={busy}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setKeep('');
              setDuplicate('');
              setReview(null);
              resetCounter();
            }}
          >
            <option value="asset">Aircraft / equipment</option>
            <option value="battery">Batteries</option>
          </select>
        </label>
        {[
          ['Keep record', keep, setKeep],
          ['Possible duplicate', duplicate, setDuplicate],
        ].map(([label, value, setter]) => (
          <label key={String(label)} className="field">
            {String(label)}
            <select
              disabled={busy}
              value={String(value)}
              onChange={(e) => {
                (setter as typeof setKeep)(e.target.value);
                setReview(null);
                resetCounter();
              }}
            >
              <option value="">Choose…</option>
              {items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.data.name || r.data.sourceName || r.data.model || r.id} ·{' '}
                  {r.data.serial || r.id}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={busy || !keep || !duplicate || keep === duplicate}
        onClick={async () => {
          setBusy(true);
          setReview(null);
          resetCounter();
          try {
            setReview(
              await api('equipment-merge-review', {
                method: 'POST',
                body: JSON.stringify({
                  kind,
                  keepId: keep,
                  duplicateId: duplicate,
                }),
              }),
            );
            setError('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Reviewing server records…' : 'Compare records'}
      </Button>
      {error && <p role="alert">{error}</p>}
      {review && (
        <>
          <p>
            {review.conflicts.length
              ? review.conflicts.join(' · ')
              : 'No category or recorded-serial conflict detected. This does not prove these are the same physical item.'}
          </p>
          <div
            className="report-table-scroll"
            role="region"
            aria-label="Equipment merge differences"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Keep record</th>
                  <th>Possible duplicate</th>
                </tr>
              </thead>
              <tbody>
                {review.differences.map((r) => (
                  <tr key={r.field}>
                    <th scope="row">{r.field}</th>
                    <td>{r.keep == null ? 'Not recorded' : String(r.keep)}</td>
                    <td>
                      {r.duplicate == null
                        ? 'Not recorded'
                        : String(r.duplicate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Usage counters must be reconciled explicitly; they are never added
            together by this review. Submitted mission packages and signed
            history must retain their original source identity.
          </p>
          <section className="inspection-rule">
            <h3>Reconcile the usage register</h3>
            <p>
              Select the source supported by the equipment’s current meter or
              maintenance evidence. This prepares a proposal; it does not change
              either record.
            </p>
            <div className="form-grid">
              <label className="field">
                Counter source
                <select
                  value={counterSource}
                  onChange={(e) => {
                    setCounterSource(
                      e.target.value as CounterDecision['source'],
                    );
                    setCounterPreview(null);
                  }}
                >
                  <option value="">Choose verified source…</option>
                  {(['keep', 'duplicate'] as const).map((source) => (
                    <option key={source} value={source}>
                      {source === 'keep' ? 'Keep record' : 'Duplicate record'} ·{' '}
                      {review[source].data[
                        review.keep.kind === 'battery' ? 'cycles' : 'hours'
                      ] ?? 'Unknown'}{' '}
                      {review.keep.kind === 'battery' ? 'cycles' : 'hours'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Evidence and reason
                <textarea
                  maxLength={1000}
                  value={counterReason}
                  onChange={(e) => {
                    setCounterReason(e.target.value);
                    setCounterPreview(null);
                  }}
                  placeholder="Describe the meter reading or maintenance record supporting this value"
                />
              </label>
            </div>
            <Button
              variant="outline"
              disabled={!counterSource || counterReason.trim().length < 10}
              onClick={() => {
                try {
                  setCounterPreview(
                    reconcileEquipmentCounter(review, {
                      source: counterSource as CounterDecision['source'],
                      reason: counterReason,
                    }),
                  );
                  setError('');
                } catch (e) {
                  setCounterPreview(null);
                  setError((e as Error).message);
                }
              }}
            >
              Preview counter decision
            </Button>
            {counterPreview && (
              <div role="status">
                <p>
                  Proposed register: {counterPreview.value ?? 'Unknown'}{' '}
                  {counterPreview.field} · source {counterPreview.sourceId} ·
                  revision {counterPreview.sourceRevision}
                </p>
                <p>{counterPreview.reason}</p>
                {counterPreview.lowerThanOther && (
                  <p>
                    This is below the other record’s counter. Applying a merge
                    will require explicit reconciliation of inspection
                    baselines; a lower counter must not postpone due work.
                  </p>
                )}
                <p>
                  Equipment status, inspection baselines and canonical
                  operational routing still require validation before a merge
                  can be applied.
                </p>
              </div>
            )}
          </section>
          {[
            ['Keep record', review.keepReferences],
            ['Possible duplicate', review.duplicateReferences],
          ].map(([label, refs]) => (
            <details key={String(label)}>
              <summary>
                {String(label)} · {(refs as any[]).length} linked records
              </summary>
              <div className="kit-candidates">
                {(refs as any[]).map((r) => (
                  <p key={r.kind + ':' + r.id}>
                    {r.kind} · {r.name}
                    <small>
                      {r.id} · revision {r.revision} · {r.status}
                    </small>
                  </p>
                ))}
              </div>
            </details>
          ))}
          <details>
            <summary>
              {review.reportReferences.length} saved report snapshots
              potentially referencing these IDs
            </summary>
            {review.reportReferences.map((r) => (
              <p key={r.id}>
                {r.request.type} · {r.status} · {r.id}
              </p>
            ))}
          </details>
          <details>
            <summary>
              {review.shareReferences.length} equipment-sharing relationships
            </summary>
            {review.shareReferences.map((r) => (
              <p key={r.id}>
                {r.equipmentId} · {r.status} · recipient {r.recipientOrg}
              </p>
            ))}
          </details>
          <p className="fine-print">
            Server snapshot: {review.capturedAt}. Equipment revisions:{' '}
            {review.keep.revision} / {review.duplicate.revision}. Saved report
            matches are conservative ID matches, not permission to rewrite
            exports. Unknown legacy relationships and counter reconciliation
            remain part of merge execution review.
          </p>
        </>
      )}
    </details>
  );
}
