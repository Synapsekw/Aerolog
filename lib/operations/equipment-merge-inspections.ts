import type { ReportRecord } from '@/lib/reports/flight-report';
import {
  inspectionDue,
  inspectionMeters,
  type InspectionPlan,
  type InspectionEvent,
} from './inspections';
import type { equipmentMergeReview } from './equipment-merge-review';
import type { reconcileEquipmentCounter } from './equipment-merge-reconciliation';
/** Preview the effect of a raw counter replacement; never rewrite signed baselines. */
export function mergeInspectionImpact(
  records: ReportRecord[],
  review: ReturnType<typeof equipmentMergeReview>,
  proposal: ReturnType<typeof reconcileEquipmentCounter>,
  today: string,
) {
  const ids = new Set([review.keep.id, review.duplicate.id]);
  const equipment = records
    .filter((r) => r.kind === 'asset' || r.kind === 'battery')
    .map((r) => ({ ...r.data, id: r.id, kind: r.kind }));
  const flights = records.filter((r) => r.kind === 'flight').map((r) => r.data);
  const events = records
    .filter((r) => r.kind === 'inspection_event')
    .map((r) => r.data as InspectionEvent);
  return records
    .filter(
      (r) =>
        r.kind === 'inspection_plan' &&
        r.data.targetKind === review.keep.kind &&
        ids.has(r.data.targetId),
    )
    .flatMap((record) => {
      const plan = { ...record.data, id: record.id } as InspectionPlan;
      const current = inspectionMeters(plan, equipment, flights);
      const proposed = { ...current, [proposal.field]: proposal.value };
      const before = inspectionDue(plan, events, current, today),
        after = inspectionDue(plan, events, proposed, today);
      return before.map((prior, index) => {
        const next = after[index];
        const changes = prior.limits.map((limit) => {
          const projected =
            next.limits.find((l) => l.unit === limit.unit)?.remaining ?? null;
          return {
            unit: limit.unit,
            before: limit.remaining,
            after: projected,
            postponed:
              limit.remaining != null &&
              projected != null &&
              projected > limit.remaining,
          };
        });
        return {
          planId: plan.id,
          planRevision: record.revision,
          targetId: plan.targetId,
          ruleId: prior.rule.id,
          ruleName: prior.rule.name,
          beforeStatus: prior.status,
          afterStatus: next.status,
          changes,
          requiresReconciliation: changes.some((c) => c.before !== c.after),
          losesDueStatus: prior.status === 'Due' && next.status !== 'Due',
        };
      });
    });
}
