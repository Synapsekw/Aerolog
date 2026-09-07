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

// Crew may include external personnel without logins. Never fall back from an
// explicit account ID to a name, or allocate one flight to multiple profiles.
export function crewFlightTotals(
  crew: { id: string; name: string; authUserId?: string }[],
  members: Profile[],
  flights: Flight[],
) {
  const byId = new Map(crew.map(person => [person.id, { flights: 0, seconds: 0 }]));
  const accountFor = (person: typeof crew[number]) => {
    if (person.authUserId) return person.authUserId;
    const matches = members.filter(m => m.display_name === person.name);
    return matches.length === 1 ? matches[0].id : undefined;
  };
  let unattributed = 0;
  for (const flight of flights) {
    const namedMembers = members.filter(m => m.display_name === flight.pilot);
    const account = flight.pilotUserId || (namedMembers.length === 1 ? namedMembers[0].id : undefined);
    const candidates = account
      ? crew.filter(person => accountFor(person) === account)
      : !flight.pilotUserId && namedMembers.length === 0
        ? crew.filter(person => !person.authUserId && person.name === flight.pilot)
        : [];
    if (candidates.length !== 1) { unattributed++; continue; }
    const total = byId.get(candidates[0].id)!;
    total.flights++;
    total.seconds += flight.durationSeconds;
  }
  return { byId, unattributed };
}
