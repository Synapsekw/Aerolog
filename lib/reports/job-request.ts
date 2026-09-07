import { z } from 'zod';
import { reportRequestSchema } from './flight-report';
export const costReportRequestSchema = z.object({
  type: z.literal('Maintenance costs'),
  from: z.iso.date(),
  to: z.iso.date(),
  format: z.enum(['CSV', 'PDF']).default('CSV'),
  projectScope: z.discriminatedUnion('mode', [z.object({mode:z.literal('all')}),z.object({mode:z.literal('unallocated')}),z.object({mode:z.literal('project'),projectId:z.string().min(1).max(100)})]).optional(),
}).refine(r => r.from <= r.to, 'Report end date must follow the start date');
export const reportJobRequestSchema = z.union([reportRequestSchema, costReportRequestSchema]);
