import type { Flight, Profile } from './models';

// Explicit user identity always wins; legacy names are attributed only when unique.
export function memberFlightTotals(members: Profile[], flights: Flight[]) {
  const byId = new Map(
    members.map((member) => [member.id, { flights: 0, seconds: 0 }]),
  );
  const byName = new Map<string, string[]>();
  for (const member of members)
    byName.set(member.display_name, [
      ...(byName.get(member.display_name) || []),
      member.id,
    ]);
  let unattributed = 0;
  for (const flight of flights) {
    const names = byName.get(flight.pilot) || [];
    const id =
      flight.pilotUserId || (names.length === 1 ? names[0] : undefined);
    const total = id ? byId.get(id) : undefined;
    if (total) {
      total.flights++;
      total.seconds += flight.durationSeconds;
    } else unattributed++;
  }
  return { byId, unattributed };
}
