'use client';
import { useState } from 'react';
import { Battery as BatteryIcon, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Status } from './shared';
import { batteryGroup } from '@/lib/battery/groups';
import type { Battery } from '@/lib/domain/models';
export default function BatteryBrowser({
  batteries,
  onOpen,
}: {
  batteries: Battery[];
  onOpen: (id: string) => void;
}) {
  const [group, setGroup] = useState('All'),
    [page, setPage] = useState(0);
  const groups = new Map<string, number>();
  batteries.forEach((b) => {
    const g = batteryGroup(b);
    groups.set(g, (groups.get(g) || 0) + 1);
  });
  const selected = batteries.filter(
    (b) => group === 'All' || batteryGroup(b) === group,
  );
  const pages = Math.max(1, Math.ceil(selected.length / 24)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <section className="glass battery-browser-heading">
        <div>
          <span className="eyebrow">BATTERY FLEET</span>
          <h2>Find the right pack</h2>
          <p>
            {selected.length} batteries · Grouped by recorded model or aircraft
            family
          </p>
        </div>
        <label className="field">
          <span>Battery type</span>
          <select
            aria-label="Battery type"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setPage(0);
            }}
          >
            <option value="All">All types ({batteries.length})</option>
            {[...groups]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([g, n]) => (
                <option key={g} value={g}>
                  {g} ({n})
                </option>
              ))}
            {group !== 'All' && !groups.has(group) && (
              <option value={group}>{group} (0)</option>
            )}
          </select>
        </label>
      </section>
      <div className="battery-grid">
        {selected.slice(current * 24, (current + 1) * 24).map((b) => (
          <button
            className="glass battery-card"
            key={b.id}
            onClick={() => onOpen(b.id)}
          >
            <div className="row">
              <BatteryIcon size={24} />
              <Status>{b.status}</Status>
            </div>
            <span className="eyebrow">{batteryGroup(b)}</span>
            <h3>
              {b.sourceName || b.model}
              <small>{b.serial || b.id}</small>
            </h3>
            <p>{b.aircraft}</p>
            <div className="capacity">
              <strong>
                {b.health ?? '—'}
                <span>%</span>
              </strong>
              <span>Measured health</span>
            </div>
            <div className="battery-card-foot">
              <span>{b.cycles} cycles</span>
              <span>{b.temp == null ? 'No temperature' : `${b.temp}°C`}</span>
              <ArrowUpRight size={16} />
            </div>
          </button>
        ))}
      </div>
      {!selected.length && (
        <p role="status">No batteries match these filters.</p>
      )}
      <div className="row">
        <Button
          variant="outline"
          disabled={!current}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </Button>
        <span>
          Page {current + 1} of {pages} · {selected.length} batteries
        </span>
        <Button
          variant="outline"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </div>
    </>
  );
}
