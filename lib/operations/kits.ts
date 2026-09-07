import { z } from 'zod';
import type { Asset, Battery } from '@/lib/domain/models';
export const kitSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(160),
    notes: z.string().max(12000).default(''),
    archived: z.boolean().default(false),
    items: z
      .array(
        z.object({
          kind: z.enum(['asset', 'battery']),
          id: z.string().min(1).max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((k, c) => {
    if (
      new Set(k.items.map((i) => i.kind + ':' + i.id)).size !== k.items.length
    )
      c.addIssue({
        code: 'custom',
        message: 'Each item can only appear once in a kit',
        path: ['items'],
      });
  });
export type Kit = z.infer<typeof kitSchema>;
export function kitContents(kit: Kit, assets: Asset[], batteries: Battery[]) {
  return kit.items.map((item) => {
    const record =
      item.kind === 'asset'
        ? assets.find((a) => a.id === item.id)
        : batteries.find((b) => b.id === item.id);
    const name = record
      ? 'name' in record
        ? record.name
        : record.sourceName || record.model
      : item.id;
    const ready =
      record &&
      (item.kind === 'asset'
        ? record.status === 'Available'
        : record.status === 'Healthy');
    return {
      ...item,
      name,
      status: record?.status || 'Missing record',
      ready: Boolean(ready),
    };
  });
}
