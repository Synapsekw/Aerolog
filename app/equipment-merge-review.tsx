'use client';
import { useState } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { equipmentMergeReview } from '@/lib/operations/equipment-merge-review';
import {
  reconcileEquipmentCounter,
  type CounterDecision,
} from '@/lib/operations/equipment-merge-reconciliation';
import { mergeInspectionImpact } from '@/lib/operations/equipment-merge-inspections';
import type { ReportRecord } from '@/lib/reports/flight-report';
import { api } from '@/lib/supabase-browser';
export default function EquipmentMergeReview() {
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false),
    [operationId, setOperationId] = useState(''),
    [receipt, setReceipt] = useState<any>(null);
  const [counterSource, setCounterSource] = useState<
      CounterDecision['source'] | ''
    >(''),
    [counterReason, setCounterReason] = useState(''),
    [counterPreview, setCounterPreview] = useState<ReturnType<
      typeof reconcileEquipmentCounter
    > | null>(null);
  const resetCounter = () => {
    setCounterSource('');
    setPhysicalConfirmed(false);
    setOperationId(crypto.randomUUID());
    setCounterReason('');
    setCounterPreview(null);
  };
  const app = useApp(),
    [kind, setKind] = useState<'asset' | 'battery'>('asset'),
    [keep, setKeep] = useState(''),
    [duplicate, setDuplicate] = useState(''),
    [review, setReview] = useState<
      | (ReturnType<typeof equipmentMergeReview> & {
          inspectionContext: ReportRecord[];
          contextFingerprint: string;
          aliases: import('@/lib/domain/equipment-identity').EquipmentAlias[];
          inspectionMeterRoutes: import('@/lib/operations/inspection-meter-routing').InspectionMeterRoute[];
          reportReferences: any[];
          shareReferences: any[];
          capturedAt: string;
          reviewDate: string;
          reviewHash: string;
        })
      | null
    >(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!['admin', 'manager'].includes(app.profile.role)) return null;
  const items = app.records.filter(
    (r) =>
      r.kind === kind &&
      !(app.equipmentAliases || []).some(
        (alias) => alias.kind === r.kind && alias.source_id === r.id,
      ),
  );
  return (
    <details className="glass equipment-bulk-editor">
      <summary>Review possible inventory duplicates</summary>
      <p>
        Compare identities, counters and linked records before consolidation.
        Merge only records for the same physical item. Original records and
        signed history are retained; new assignments use the canonical record.
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
          setReceipt(null);
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
                  disabled={busy}
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
                  disabled={busy}
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
              disabled={
                busy || !counterSource || counterReason.trim().length < 10
              }
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
                    will preserve accrued inspection usage through counter
                    mapping; signed baselines are retained.
                  </p>
                )}
                <p>
                  The merge retains the more restrictive equipment condition and
                  earliest service limit. Active mission packages, open work
                  orders and active shares must be resolved first.
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
            exports. Source records and report snapshots are retained after a
            merge.
          </p>
        </>
      )}
      {review && counterPreview && (
        <section className="inspection-rule">
          <h3>Inspection comparison before counter mapping</h3>
          <p>
            Compares a direct counter replacement against current signed
            baselines. The merge preserves original inspection usage through
            counter mapping. This comparison shows the risk of a direct
            replacement; calendar dates stay unchanged.
          </p>
          {(() => {
            const impacts = mergeInspectionImpact(
              review.inspectionContext,
              review,
              counterPreview,
              review.reviewDate,
              review.inspectionMeterRoutes,
              review.aliases,
            );
            return impacts.length ? (
              impacts.map((impact) => (
                <article key={impact.planId + ':' + impact.ruleId}>
                  <h4>
                    {impact.ruleName} · {impact.targetId}
                  </h4>
                  <p>
                    {impact.beforeStatus} → {impact.afterStatus}
                    {impact.requiresReconciliation
                      ? ' · Counter mapping will preserve original usage'
                      : ''}
                  </p>
                  {impact.changes.map((change) => (
                    <p key={change.unit}>
                      {change.unit}: {change.before ?? 'Unknown'} →{' '}
                      {change.after ?? 'Unknown'} remaining
                      {change.postponed ? ' · Would postpone inspection' : ''}
                    </p>
                  ))}
                  <small>
                    Plan {impact.planId} · revision {impact.planRevision}
                  </small>
                </article>
              ))
            ) : (
              <p>
                No inspection profiles are assigned to these two equipment
                records.
              </p>
            );
          })()}
        </section>
      )}
      {review && counterPreview && (
        <section className="inspection-rule">
          <h3>Apply the reviewed merge</h3>
          <p>
            The keep record retains its name and metadata. Its selected usage
            counter, conservative readiness values, earliest service limit and
            inspection mappings are saved together. Source records remain
            immutable, and existing kits/drafts may need equipment reselection.
            This merge cannot be undone from the app.
          </p>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={physicalConfirmed}
                disabled={busy}
                onChange={(e) => setPhysicalConfirmed(e.target.checked)}
              />{' '}
              I verified that both records represent the same physical
              equipment.
            </span>
          </label>
          <Button
            disabled={busy || !physicalConfirmed || review.conflicts.length > 0}
            onClick={async () => {
              setBusy(true);
              setError('');
              const body = {
                operationId,
                kind,
                keepId: keep,
                duplicateId: duplicate,
                contextFingerprint: review.contextFingerprint,
                counterSource,
                reason: counterPreview.reason,
                physicalIdentityConfirmed: true,
              };
              try {
                let result;
                try {
                  result = await api('equipment-merge', {
                    method: 'POST',
                    body: JSON.stringify(body),
                  });
                } catch (originalError) {
                  try {
                    result = await api('equipment-merge?id=' + operationId);
                  } catch {
                    throw originalError;
                  }
                }
                setReceipt(result);
                setReview(null);
                setCounterPreview(null);
                setDuplicate('');
                setPhysicalConfirmed(false);
                await app.refresh();
                app.notify('Equipment merged. Source history retained.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Applying reviewed merge…' : 'Merge equipment'}
          </Button>
        </section>
      )}
      {receipt && (
        <section className="inspection-rule" role="status">
          <h3>Merge completed</h3>
          <p>
            {receipt.duplicateId} → {receipt.keepId} ·{' '}
            {receipt.equipment.status}
          </p>
          <p>
            {receipt.inspectionPlans} inspection profiles retain their original
            meter scale.
          </p>
          <small>
            Receipt {receipt.id} · {receipt.createdAt}
          </small>
        </section>
      )}
    </details>
  );
}
