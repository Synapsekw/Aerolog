import { z } from 'zod';
export const qualificationSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(160),
    issuer: z.string().max(160).default(''),
    reference: z.string().max(160).default(''),
    issued: z.union([z.iso.date(), z.literal('')]).default(''),
    expires: z.iso.date(),
    requiredForOperations: z.boolean(),
    evidenceId: z.string().max(100).default(''),
  })
  .refine(
    (q) => !q.issued || q.issued <= q.expires,
    'Qualification expiry must follow issue date',
  );
export function qualificationState(
  q: { issued?: string; expires: string; evidenceId?: string },
  date: string,
) {
  if (q.issued && q.issued > date) return 'Not yet valid';
  if (q.expires < date) return 'Expired';
  if (!q.evidenceId) return 'Evidence missing';
  return 'Current';
}
