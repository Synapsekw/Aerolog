import type { InspectionMeterRoute } from './inspection-meter-routing';
import type { EquipmentAlias } from '@/lib/domain/equipment-identity';
import {
  inspectionDue,
  inspectionMeters,
  type InspectionPlan,
  type InspectionEvent,
} from './inspections';
export function inspectionCalendar(
  plans: InspectionPlan[],
  events: InspectionEvent[],
  equipment: any[],
  flights: any[],
  today: string,
  routes: InspectionMeterRoute[] = [],
  aliases: EquipmentAlias[] = [],
) {
  let withoutCalendarDate = 0;
  const entries = plans.flatMap((plan) => {
    const target = equipment.find(
      (e) => e.kind === plan.targetKind && e.id === plan.targetId,
    );
    return inspectionDue(
      plan,
      events,
      inspectionMeters(plan, equipment, flights, routes, aliases),
      today,
    ).flatMap((due) => {
      if (!due.dueDate) {
        withoutCalendarDate++;
        return [];
      }
      return [
        {
          id: plan.id + ':' + due.rule.id,
          kind: 'inspection' as const,
          name:
            (target?.name ||
              target?.sourceName ||
              target?.model ||
              plan.targetId) +
            ' · ' +
            due.rule.name,
          date: due.dueDate,
          time: '',
          status: due.status,
          targetKind: plan.targetKind,
          targetId: plan.targetId,
        },
      ];
    });
  });
  return { entries, withoutCalendarDate };
}
