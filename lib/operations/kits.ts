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

export function kitAssignment(
  kit: Kit,
  assets: Asset[],
  batteries: Battery[],
  currentAircraft: string,
  rules: { batteryMinHealth: number; batteryMaxTemperature: number },
) {
  const contents = kitContents(kit, assets, batteries);
  const aircraft = kit.items
    .filter((i) => i.kind === 'asset')
    .map((i) => assets.find((a) => a.id === i.id))
    .filter((a): a is Asset => Boolean(a && a.category === 'Aircraft'));
  const selectedAircraft = aircraft[0]?.name || currentAircraft;
  const blockers: string[] = [];
  if (kit.archived) blockers.push('This kit is archived.');
  for (const item of contents) {
    if (!item.ready) blockers.push(`${item.name}: ${item.status}`);
    if (item.kind === 'asset') {
      const a = assets.find((a) => a.id === item.id);
      if (a && (a.hours == null || a.next == null || a.hours >= a.next))
        blockers.push(`${item.name}: service counters need review`);
    } else {
      const b = batteries.find((b) => b.id === item.id);
      if (
        b &&
        ![selectedAircraft, ...aircraft.map((a) => a.name)].includes(b.aircraft)
      )
        blockers.push(
          `${item.name}: not assigned to ${selectedAircraft || 'an aircraft'}`,
        );
      if (
        b &&
        (b.health == null ||
          b.temp == null ||
          b.health < rules.batteryMinHealth ||
          b.temp > rules.batteryMaxTemperature)
      )
        blockers.push(`${item.name}: battery measurements need review`);
    }
  }
  return {
    aircraft: selectedAircraft,
    additionalAircraft: aircraft
      .map((a) => a.name)
      .filter((n) => n !== selectedAircraft),
    equipment: kit.items.flatMap((i) =>
      i.kind === 'battery'
        ? [i.id]
        : assets
            .filter((a) => a.id === i.id && a.category !== 'Aircraft')
            .map((a) => a.name),
    ),
    blockers,
  };
}
