import { z } from 'zod';
export const documentSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(160),
    category: z.enum(['Permit', 'Insurance', 'SOP', 'Qualification', 'Other']),
    targetKind: z.enum([
      'Organization',
      'crew',
      'asset',
      'battery',
      'project',
      'mission',
    ]),
    targetId: z.string().max(100).default(''),
    validFrom: z.union([z.iso.date(), z.literal('')]).default(''),
    expires: z.union([z.iso.date(), z.literal('')]).default(''),
    attachmentId: z.string().max(100).default(''),
    notes: z.string().max(12000).default(''),
    archived: z.boolean().default(false),
  })
  .refine(
    (d) => !d.validFrom || !d.expires || d.validFrom <= d.expires,
    'Expiry must follow the valid-from date',
  );
export const documentSelectionSchema = z.object({
  id: z.string().min(1).max(100),
  revision: z.number().int().positive(),
});
