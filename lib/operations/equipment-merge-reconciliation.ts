import type { equipmentMergeReview } from './equipment-merge-review';
type Review = ReturnType<typeof equipmentMergeReview>;
export type CounterDecision = { source: 'keep' | 'duplicate'; reason: string };
/** A proposed register value, never a sum of overlapping imported totals. */
export function reconcileEquipmentCounter(
  review: Review,
  decision: CounterDecision,
) {
  const reason = decision.reason.trim();
  if (reason.length < 10 || reason.length > 1000)
    throw Error('Explain the counter evidence in 10–1000 characters.');
  if (!['keep', 'duplicate'].includes(decision.source))
    throw Error('Select the source of the counter.');
  const field = review.keep.kind === 'battery' ? 'cycles' : 'hours';
  const selected = review[decision.source];
  const value = selected.data[field];
  if (
    value !== null &&
    value !== undefined &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100000 ||
      (field === 'cycles' && !Number.isInteger(value)))
  ) {
    throw Error(
      'Selected counter is invalid; repair the source record before merging.',
    );
  }
  if (field === 'cycles' && value == null)
    throw Error(
      'Battery cycle count is missing; record a verified baseline first.',
    );
  const lowerThanOther =
    typeof value === 'number' &&
    typeof review[decision.source === 'keep' ? 'duplicate' : 'keep'].data[
      field
    ] === 'number' &&
    value <
      review[decision.source === 'keep' ? 'duplicate' : 'keep'].data[field];
  return {
    field,
    value: value ?? null,
    sourceKind: selected.kind,
    sourceId: selected.id,
    sourceRevision: selected.revision,
    reason,
    lowerThanOther,
  };
}
