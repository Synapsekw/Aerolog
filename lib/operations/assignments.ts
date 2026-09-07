import type { Crew, Profile, Mission } from '@/lib/domain/models';
export function crewCanBeAssigned(crew: Crew, members: Profile[]) {
  const matches = members.filter((m) =>
    crew.authUserId ? m.id === crew.authUserId : m.display_name === crew.name,
  );
  return crew.status === 'Available' && !matches.some((m) => !m.active);
}
export function missionAircraft(
  m: Pick<Mission, 'aircraft' | 'additionalAircraft'>,
) {
  return [
    ...new Set([m.aircraft, ...(m.additionalAircraft || [])].filter(Boolean)),
  ];
}
export function missionOverlaps(
  a: Pick<Mission, 'date' | 'time' | 'durationMinutes'>,
  b: Pick<Mission, 'date' | 'time' | 'durationMinutes'>,
) {
  const start = (m: typeof a) => Date.parse(`${m.date}T${m.time}:00Z`);
  return (
    start(a) < start(b) + b.durationMinutes * 60000 &&
    start(b) < start(a) + a.durationMinutes * 60000
  );
}
