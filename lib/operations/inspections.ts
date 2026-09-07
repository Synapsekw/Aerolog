import { z } from 'zod';
const id = z.string().min(1).max(100),
  text = z.string().trim().min(1).max(160),
  meter = z.number().nonnegative().max(1000000).nullable();
export const metersSchema = z.object({
  hours: meter,
  flights: meter,
  cycles: meter,
});
export const inspectionProfileSchema = z
  .object({
    id,
    name: text,
    model: text,
    archived: z.boolean().default(false),
    rules: z
      .array(
        z.object({
          id,
          name: text,
          component: z.string().max(160).default(''),
          action: z.enum(['Inspect', 'Replace']),
          hours: z.number().positive().max(100000).nullable(),
          flights: z.number().int().positive().max(1000000).nullable(),
          cycles: z.number().int().positive().max(1000000).nullable(),
          days: z.number().int().positive().max(36500).nullable(),
        }),
      )
      .min(1)
      .max(40),
  })
  .superRefine((p, c) => {
    if (new Set(p.rules.map((r) => r.id)).size !== p.rules.length)
      c.addIssue({ code: 'custom', message: 'Rule IDs must be unique' });
    p.rules.forEach((r, i) => {
      if ([r.hours, r.flights, r.cycles, r.days].every((x) => x == null))
        c.addIssue({
          code: 'custom',
          message: 'Set at least one interval',
          path: ['rules', i],
        });
    });
  });
export const inspectionPlanSchema = z.object({
  id,
  profileId: id,
  targetKind: z.enum(['asset', 'battery']),
  targetId: id,
  baselineDate: z.iso.date(),
  baseline: metersSchema,
});
export const inspectionEventSchema = z.object({
  id,
  planId: id,
  ruleId: id,
  date: z.iso.date(),
  meters: metersSchema,
  findings: z.string().trim().min(10).max(12000),
  replacementSerial: z.string().max(160).default(''),
});
export type InspectionProfile = z.infer<typeof inspectionProfileSchema>;
export type InspectionPlan = z.infer<typeof inspectionPlanSchema> & {
  profileSnapshot: InspectionProfile;
  profileRevision: number;
  capturedFlightCount: number;
};
export type InspectionEvent = z.infer<typeof inspectionEventSchema> & {
  signedBy: string;
  signedAt?: string;
};
export function inspectionDue(
  plan: InspectionPlan,
  events: InspectionEvent[],
  current: z.infer<typeof metersSchema>,
  today: string,
) {
  return plan.profileSnapshot.rules.map((rule) => {
    const event = events
      .filter((e) => e.planId === plan.id && e.ruleId === rule.id)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.signedAt || '').localeCompare(a.signedAt || ''),
      )[0];
    const baseline = event?.meters || plan.baseline,
      date = event?.date || plan.baselineDate;
    const limits = (['hours', 'flights', 'cycles'] as const).flatMap((key) =>
      rule[key] == null
        ? []
        : [
            {
              unit: key,
              remaining:
                current[key] == null ||
                baseline[key] == null ||
                current[key]! < baseline[key]!
                  ? null
                  : rule[key]! - (current[key]! - baseline[key]!),
            },
          ],
    );
    if (rule.days != null)
      limits.push({
        unit: 'days' as any,
        remaining:
          rule.days -
          (Date.parse(today + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) /
            86400000,
      });
    const overdue = limits.some((l) => l.remaining != null && l.remaining <= 0),
      unknown = limits.some((l) => l.remaining == null);
    return {
      rule,
      limits,
      status: overdue ? 'Due' : unknown ? 'Needs counters' : 'Within limits',
      dueDate:
        rule.days == null
          ? undefined
          : new Date(Date.parse(date + 'T00:00:00Z') + rule.days * 86400000)
              .toISOString()
              .slice(0, 10),
    };
  });
}

export function inspectionMeters(
  plan: InspectionPlan,
  equipment: any[],
  flights: any[],
) {
  const eq = equipment.find(
    (a) => a.kind === plan.targetKind && a.id === plan.targetId,
  );
  const count = flights.filter((f) =>
    plan.targetKind === 'battery'
      ? f.battery === plan.targetId || f.batteryIds?.includes(plan.targetId)
      : f.aircraftId === plan.targetId ||
        f.equipmentIds?.includes(plan.targetId) ||
        f.aircraft === eq?.name,
  ).length;
  return {
    hours: eq?.hours ?? null,
    cycles: eq?.cycles ?? null,
    flights:
      plan.baseline.flights == null || count < plan.capturedFlightCount
        ? null
        : plan.baseline.flights + count - plan.capturedFlightCount,
  };
}
