'use client';
import { duplicateMatches } from '@/lib/flight/duplicates';
import type { Flight } from '@/lib/domain/models';
export default function ImportReview({
  incoming,
  existing,
  allowNew,
  onAllowNew,
}: {
  incoming: Flight[];
  existing: Flight[];
  allowNew: Set<string>;
  onAllowNew: (id: string, value: boolean) => void;
}) {
  return (
    <div className="import-review">
      {incoming.map((flight, i) => {
        const matches = duplicateMatches(flight, [
            ...existing,
            ...incoming.slice(0, i),
          ]),
          exact = matches.some((m) => m.kind === 'exact');
        return (
          <section className="import-review-row" key={flight.id}>
            <strong>
              {flight.mission} · {flight.date}
            </strong>
            <p>
              {flight.duration} · {flight.distance} km ·{' '}
              {flight.telemetry.length} samples
            </p>
            {matches.length ? (
              <>
                <p className="fine-print">
                  {matches
                    .map(
                      (m) =>
                        `${m.reason}: ${m.flight.mission} (${m.flight.id})`,
                    )
                    .join('; ')}
                </p>
                {exact ? (
                  <strong>Already imported · skipped</strong>
                ) : (
                  <label className="field">
                    <span>Review possible duplicate</span>
                    <select
                      aria-label={`Import decision for ${flight.id}`}
                      value={allowNew.has(flight.id) ? 'new' : 'skip'}
                      onChange={(e) =>
                        onAllowNew(flight.id, e.target.value === 'new')
                      }
                    >
                      <option value="skip">Skip this record</option>
                      <option value="new">
                        This is a different flight — import separately
                      </option>
                    </select>
                  </label>
                )}
              </>
            ) : (
              <small>New flight</small>
            )}
          </section>
        );
      })}
    </div>
  );
}
