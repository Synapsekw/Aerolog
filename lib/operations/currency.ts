import { z } from 'zod';
export const currencyPolicySchema = z
  .object({
    enabled: z.boolean(),
    days: z.number().int().min(1).max(730),
    minimumFlights: z.number().int().min(0).max(10000),
    minimumMinutes: z.number().min(0).max(100000),
    includeExternal: z.boolean(),
  })
  .refine(
    (p) => !p.enabled || p.minimumFlights > 0 || p.minimumMinutes > 0,
    'Enabled recency policies need a flight or time minimum',
  );
export const externalTimeSchema = z.object({
  voided: z.boolean().optional(),
  voidReason: z.string().max(4000).optional(),
  id: z.string().min(1).max(100),
  date: z.iso.date(),
  flights: z.number().int().min(1).max(10000),
  minutes: z.number().positive().max(100000),
  source: z.string().trim().min(3).max(160),
  notes: z.string().trim().min(5).max(4000),
  evidenceId: z.string().min(1).max(100),
});
export function currencySummary(person: any, flights: any[], date: string) {
  const policy = person.currencyPolicy || {
    enabled: false,
    days: 90,
    minimumFlights: 0,
    minimumMinutes: 0,
    includeExternal: false,
  };
  const start = new Date(
    Date.parse(date + 'T00:00:00Z') - policy.days * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const within = (d: string) => Boolean(d) && d >= start && d < date;
  const local = flights.filter(
    (f) =>
      within(f.date) &&
      (f.pilotUserId
        ? f.pilotUserId === person.authUserId
        : f.pilot === person.name),
  );
  const external = (person.externalTime || []).filter(
    (e: any) => !e.voided && within(e.date),
  );
  const localMinutes = local.reduce((n, f) => n + f.durationSeconds / 60, 0),
    externalMinutes = external.reduce((n: number, e: any) => n + e.minutes, 0),
    externalFlights = external.reduce((n: number, e: any) => n + e.flights, 0);
  const count = local.length + (policy.includeExternal ? externalFlights : 0),
    minutes = localMinutes + (policy.includeExternal ? externalMinutes : 0);
  return {
    start,
    end: date,
    localFlights: local.length,
    localMinutes,
    externalFlights,
    externalMinutes,
    count,
    minutes,
    met:
      !policy.enabled ||
      (count >= policy.minimumFlights && minutes >= policy.minimumMinutes),
  };
}
