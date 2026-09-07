import { z } from 'zod';
const id = z.string().min(1).max(100),
  name = z.string().trim().min(1).max(160),
  notes = z.string().max(12000).default(''),
  ref = z.string().max(100).default('');
const base = { id, name, notes, archived: z.boolean().default(false) };
export const customerSchema = z.object({
  ...base,
  contactName: z.string().max(160).default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: z.string().max(80).default(''),
});
export const projectSchema = z
  .object({
    ...base,
    customerId: ref,
    reference: z.string().max(100).default(''),
    startDate: z.union([z.iso.date(), z.literal('')]).default(''),
    endDate: z.union([z.iso.date(), z.literal('')]).default(''),
    revenue: z.number().nonnegative().max(1000000000).nullable().default(null),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('AED'),
  })
  .refine((p) => !p.startDate || !p.endDate || p.startDate <= p.endDate, {
    message: 'End date must follow start date',
    path: ['endDate'],
  });
export const siteSchema = z.object({
  ...base,
  purpose: z.enum(['Operating area', 'Storage', 'Both']),
  projectId: ref,
  address: z.string().max(500).default(''),
  geometry: z
    .array(
      z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    )
    .max(500)
    .default([]),
});
export const catalogSchemas = {
  customer: customerSchema,
  project: projectSchema,
  site: siteSchema,
};
export type CatalogKind = keyof typeof catalogSchemas;
