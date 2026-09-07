export type InspectionMeterRoute = {
  plan_id: string;
  target_kind: 'asset' | 'battery';
  target_id: string;
  hours_anchor: number | null;
  cycles_anchor: number | null;
  flights_anchor: number;
  hours_base: number | null;
  cycles_base: number | null;
  flights_base: number | null;
};
type Meters = {
  hours: number | null;
  cycles: number | null;
  flights: number | null;
};
/** Keep the inspection's original meter coordinates across a register change. */
export function routedInspectionMeters(
  route: InspectionMeterRoute,
  current: Meters,
): Meters {
  const translate = (unit: keyof Meters) => {
    const anchor = route[`${unit}_anchor`],
      base = route[`${unit}_base`],
      value = current[unit];
    if (
      anchor == null ||
      base == null ||
      value == null ||
      ![anchor, base, value].every(Number.isFinite) ||
      value < anchor
    )
      return null;
    return base + value - anchor;
  };
  return {
    hours: translate('hours'),
    cycles: translate('cycles'),
    flights: translate('flights'),
  };
}
export function captureInspectionMeterRoute(
  planId: string,
  targetKind: 'asset' | 'battery',
  targetId: string,
  before: Meters,
  register: Meters,
): InspectionMeterRoute {
  if (
    register.flights == null ||
    !Number.isInteger(register.flights) ||
    register.flights < 0
  )
    throw Error('A verified linked-flight count is required.');
  for (const value of [...Object.values(before), ...Object.values(register)])
    if (value != null && (!Number.isFinite(value) || value < 0))
      throw Error(
        'Inspection meter routes require nonnegative finite values or explicit unknowns.',
      );
  return {
    plan_id: planId,
    target_kind: targetKind,
    target_id: targetId,
    hours_base: before.hours,
    cycles_base: before.cycles,
    flights_base: before.flights,
    hours_anchor: register.hours,
    cycles_anchor: register.cycles,
    flights_anchor: register.flights,
  };
}
