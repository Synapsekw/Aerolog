import { z } from 'zod';
const short = z.string().trim().min(1).max(160);
export const formFieldSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: short,
    type: z.enum(['Check', 'Text', 'Number', 'Date', 'Choice']),
    required: z.boolean(),
    options: z.array(short).max(30).default([]),
  })
  .refine(
    (f) =>
      f.type !== 'Choice' ||
      (f.options.length > 0 && new Set(f.options).size === f.options.length),
    'Choice fields need distinct options',
  );
export const formTemplateSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: short,
    type: z.enum(['Checklist', 'Custom form', 'Risk assessment']),
    notes: z.string().max(12000).default(''),
    archived: z.boolean().default(false),
    fields: z.array(formFieldSchema).max(50).default([]),
    hazards: z
      .array(
        z.object({
          hazard: short,
          mitigation: z.string().max(12000),
          likelihood: z.number().int().min(1).max(5),
          severity: z.number().int().min(1).max(5),
        }),
      )
      .max(50)
      .default([]),
  })
  .refine(
    (t) =>
      t.type === 'Risk assessment' ? t.hazards.length > 0 : t.fields.length > 0,
    'Add at least one field or hazard',
  )
  .refine(
    (t) => new Set(t.fields.map((f) => f.id)).size === t.fields.length,
    'Field IDs must be unique',
  )
  .refine(
    (t) => t.type !== 'Checklist' || t.fields.every((f) => f.type === 'Check'),
    'Checklist fields must be checks',
  );
export const missionFormSchema = z.object({
  templateId: z.string().min(1).max(100),
  revision: z.number().int().positive(),
  answers: z
    .record(
      z.string().max(100),
      z.union([z.string().max(12000), z.number().finite(), z.boolean()]),
    )
    .default({}),
});
export type FormTemplate = z.infer<typeof formTemplateSchema>;
