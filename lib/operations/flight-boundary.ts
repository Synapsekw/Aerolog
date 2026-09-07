type Point = [number, number];
const EPSILON = 1e-12;
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const cross = (a: Point, b: Point, p: Point) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const onSegment = (a: Point, b: Point, p: Point) =>
  Math.abs(cross(a, b, p)) <= EPSILON &&
  p[0] >= Math.min(a[0], b[0]) - EPSILON &&
  p[0] <= Math.max(a[0], b[0]) + EPSILON &&
  p[1] >= Math.min(a[1], b[1]) - EPSILON &&
  p[1] <= Math.max(a[1], b[1]) + EPSILON;
function intersects(a: Point, b: Point, c: Point, d: Point) {
  if (onSegment(a, b, c) || onSegment(a, b, d) ||
      onSegment(c, d, a) || onSegment(c, d, b)) return true;
  return (cross(a, b, c) > 0) !== (cross(a, b, d) > 0) &&
    (cross(c, d, a) > 0) !== (cross(c, d, b) > 0);
}
/** Counts recorded positions, not elapsed time or the path between samples. */
export function compareBoundary(boundary: Point[], track: Point[]) {
  const unavailable = (reason: string) => ({ available: false as const, reason });
  const valid = (p: Point) => p.length >= 2 &&
    Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85;
  if (boundary.length < 3 || !boundary.every(valid))
    return unavailable('A valid mission area with at least three points is required.');
  // Imported polygon rings commonly repeat their first coordinate at the end.
  const ring = boundary.filter((p, i) => !i || !same(p, boundary[i - 1]));
  if (ring.length > 1 && same(ring[0], ring[ring.length - 1])) ring.pop();
  if (ring.length < 3) return unavailable('The mission boundary has no measurable area.');
  const minX = Math.min(...ring.map(p => p[0])), maxX = Math.max(...ring.map(p => p[0]));
  if (maxX - minX > 180)
    return unavailable('Antimeridian-spanning areas are not supported by this comparison.');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    // Adjacent collinear edges are valid only when they do not double back.
    const c = ring[(i + 2) % ring.length];
    if (onSegment(a, b, c) || onSegment(b, c, a))
      return unavailable('The mission boundary overlaps itself. Review its vertices.');
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue;
      if (intersects(a, b, ring[j], ring[(j + 1) % ring.length]))
        return unavailable('The mission boundary crosses or touches itself. Review its vertices.');
    }
  }
  // Translate coordinates before computing area to avoid cancellation for small sites.
  const origin = ring[0];
  const area = ring.reduce((sum, p, i) =>
    sum + cross(origin, p, ring[(i + 1) % ring.length]), 0);
  if (Math.abs(area) < EPSILON)
    return unavailable('The mission boundary has no measurable area.');
  if (track.length < 2 || !track.every(valid))
    return unavailable('At least two valid recorded track positions are required.');
  const minY = Math.min(...ring.map(p => p[1])), maxY = Math.max(...ring.map(p => p[1]));
  const inside = (p: Point) => {
    if (p[0] < minX - EPSILON || p[0] > maxX + EPSILON ||
        p[1] < minY - EPSILON || p[1] > maxY + EPSILON) return false;
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      if (onSegment(a, b, p)) return true;
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
        result = !result;
    }
    return result;
  };
  const outside = track.filter(p => !inside(p)).length;
  return { available: true as const, outside, total: track.length };
}
