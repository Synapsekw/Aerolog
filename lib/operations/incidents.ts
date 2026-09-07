import { z } from 'zod';
const ref = z.string().max(100).default('');
export const incidentSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(3).max(160),
    occurredAt: z.iso.datetime({ offset: true }),
    severity: z.enum(['Low', 'Moderate', 'High', 'Critical']),
    status: z.enum(['Reported', 'Investigating', 'Closed']),
    flightId: ref,
    projectId: ref,
    siteId: ref,
    equipment: z
      .array(
        z.object({
          kind: z.enum(['asset', 'battery']),
          id: z.string().min(1).max(100),
        }),
      )
      .max(100)
      .default([]),
    personnelIds: z.array(z.string().min(1).max(100)).max(50).default([]),
    narrative: z.string().trim().min(10).max(12000),
    cause: z.string().max(12000).default(''),
    damage: z.string().max(12000).default(''),
    resolution: z.string().max(12000).default(''),
    actions: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          task: z.string().trim().min(3).max(500),
          assignedTo: z.union([z.uuid(), z.literal('')]).default(''),
          due: z.union([z.iso.date(), z.literal('')]).default(''),
          done: z.boolean().default(false),
          completionNotes: z.string().max(4000).default(''),
        }),
      )
      .max(100)
      .default([]),
  })
  .refine(
    (d) => new Set(d.actions.map((a) => a.id)).size === d.actions.length,
    'Action IDs must be unique',
  )
  .refine(
    (d) =>
      d.status !== 'Closed' ||
      (d.resolution.trim().length >= 10 && d.actions.every((a) => a.done)),
    'Close all follow-up actions and record a resolution before closing the incident',
  )
  .refine(
    (d) =>
      d.actions.every((a) => !a.done || a.completionNotes.trim().length >= 5),
    'Completed actions need completion notes',
  );
