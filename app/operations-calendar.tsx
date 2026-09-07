'use client';
import { useMemo, useState } from 'react';
import { useApp } from './app-provider';
import { inspectionCalendar } from '@/lib/operations/inspection-calendar';
import { calendarExport } from '@/lib/operations/calendar-export';
import { Button } from '@/components/ui/button';
import type { Mission, Service, Flight } from '@/lib/domain/models';
import { missionAircraft, missionOverlaps } from '@/lib/operations/assignments';
type Entry = {
  id: string;
  kind: 'mission' | 'service' | 'flight' | 'inspection';
  targetKind?: 'asset' | 'battery';
  targetId?: string;
  name: string;
  date: string;
  time: string;
  status: string;
};
const shift = (date: string, n: number) =>
  new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
export default function OperationsCalendar({
  today,
  missions,
  services,
  flights,
  onOpen,
}: {
  today: string;
  missions: Mission[];
  services: Service[];
  flights: Flight[];
  onOpen: (kind: 'mission' | 'service' | 'flight' | 'asset' | 'battery', id: string) => void;
}) {
  const app = useApp();
  const inspections = inspectionCalendar(app.items('inspection_plan'), app.items('inspection_event'), [...app.items('asset').map(a=>({...a,kind:'asset'})),...app.items('battery').map(b=>({...b,kind:'battery'}))],flights,today);
  const [anchor, setAnchor] = useState(today),
    [selected, setSelected] = useState(today),
    [view, setView] = useState('month'),
    [type, setType] = useState('All');
  const entries: Entry[] = useMemo(
    () => [
      ...inspections.entries,
      ...missions.map((m) => ({
        id: m.id,
        kind: 'mission' as const,
        name: m.name,
        date: m.date,
        time: m.time,
        status: m.status,
      })),
      ...services.map((s) => ({
        id: s.id,
        kind: 'service' as const,
        name: s.task,
        date: s.due,
        time: '',
        status: s.status,
      })),
      ...flights
        .filter((f) => f.date)
        .map((f) => ({
          id: f.id,
          kind: 'flight' as const,
          name: f.mission || f.id,
          date: f.date,
          time: '',
          status: 'Recorded',
        })),
    ],
    [missions, services, flights, inspections.entries],
  );
  const start = new Date(
    (view === 'month' ? anchor.slice(0, 7) + '-01' : anchor) + 'T12:00:00Z',
  );
  const first = shift(
    start.toISOString().slice(0, 10),
    -((start.getUTCDay() + 6) % 7),
  );
  const days = Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) =>
    shift(first, i),
  );
  const visible = entries.filter((e) => type === 'All' || e.kind === type);
  const conflicts = missions
    .filter((m) => ['Pending approval', 'Approved'].includes(m.status))
    .filter((m) =>
      missions.some((other) => {
        if (
          other.id === m.id ||
          !['Pending approval', 'Approved'].includes(other.status) ||
          !missionOverlaps(m, other)
        )
          return false;
        const people = (x: Mission) => [
          x.pilot,
          x.observer,
          ...(x.crewAssignments || []).map((a) => a.name),
        ];
        return (
          missionAircraft(m).some((a) => missionAircraft(other).includes(a)) ||
          people(m).some((p) => people(other).includes(p)) ||
          m.equipment.some((e) => other.equipment.includes(e))
        );
      }),
    );
  function move(n: number) {
    if (view === 'week') {
      const next = shift(anchor, 7 * n);
      setAnchor(next);
      setSelected(next);
    } else {
      const d = new Date(anchor.slice(0, 7) + '-01T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + n);
      setAnchor(d.toISOString().slice(0, 10));
      setSelected(d.toISOString().slice(0, 10));
    }
  }
  return (
    <section className="glass operations-calendar">
      <div className="calendar-toolbar">
        <div>
          <span className="eyebrow">OPERATIONS SCHEDULE</span>
          <h2>
            {new Date(anchor + 'T12:00:00Z').toLocaleDateString('en', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </h2>
        </div>
        <div className="calendar-actions">
          <Button
            variant="outline"
            onClick={() => move(-1)}
            aria-label="Previous calendar period"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => move(1)}
            aria-label="Next calendar period"
          >
            Next
          </Button>
        </div>
        <div className="calendar-actions">
          <Button
            variant={view === 'month' ? 'default' : 'outline'}
            onClick={() => setView('month')}
          >
            Month
          </Button>
          <Button
            variant={view === 'week' ? 'default' : 'outline'}
            onClick={() => setView('week')}
          >
            Week
          </Button>
          <select
            aria-label="Calendar record type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="All">All operations</option>
            <option value="mission">Missions</option>
            <option value="service">Maintenance</option>
            <option value="flight">Flight logs</option>
            <option value="inspection">Inspections</option>
          </select>
          <Button variant="outline" onClick={() => {
            const exported = calendarExport(entries, { organizationId: app.organization.id, from: days[0], through: days[days.length - 1], kind: type });
            const url = URL.createObjectURL(new Blob([exported.content], { type: 'text/calendar;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `aerolog-${type.toLowerCase()}-${days[0]}.ics`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Export dates (.ics)</Button>
        </div>
      </div>
      <p>
        {conflicts.length
          ? `${conflicts.length} scheduled missions have resource conflicts requiring review.`
          : 'No conflicts between submitted or approved missions.'}{' '}
        Dates follow the organization schedule; imported flights with no date
        are excluded.
      </p>
      <p className="fine-print">Calendar export includes the displayed date range and category as all-day reminders. Scheduled times remain in each description. Downloads are snapshots and do not update automatically.</p>
      <p className="fine-print">Inspection dates show calendar intervals; hours, flights or cycles may make an inspection due earlier. {inspections.withoutCalendarDate} inspection rules have no calendar interval and remain in the inspection readiness view.</p>
      <div className="calendar-grid" role="group" aria-label="Operations dates">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <strong className="calendar-weekday" key={d}>
            {d}
          </strong>
        ))}
        {days.map((day) => {
          const events = visible.filter((e) => e.date === day);
          return (
            <button
              className={
                'calendar-day ' +
                (day === selected ? 'selected ' : '') +
                (day === today ? 'today' : '')
              }
              key={day}
              aria-label={`${day}, ${events.length} operations`}
              aria-pressed={day === selected}
              onClick={() => setSelected(day)}
            >
              <span>{Number(day.slice(-2))}</span>
              {events.slice(0, 2).map((e) => (
                <small
                  key={e.kind + e.id}
                  className={'calendar-event ' + e.kind}
                >
                  {e.time} {e.name}
                </small>
              ))}
              {events.length > 2 && <small>+{events.length - 2} more</small>}
            </button>
          );
        })}
      </div>
      <div className="calendar-agenda">
        <h3>{selected}</h3>
        {visible
          .filter((e) => e.date === selected)
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((e) => (
            <button
              className="calendar-agenda-row"
              key={e.kind + e.id}
              onClick={() => e.kind === 'inspection' ? onOpen(e.targetKind!, e.targetId!) : onOpen(e.kind, e.id)}
            >
              <span>{e.time || '—'}</span>
              <strong>{e.name}</strong>
              <span>{e.kind}</span>
              <span>{e.status}</span>
            </button>
          ))}
        {!visible.some((e) => e.date === selected) && (
          <p>No operations for this date and filter.</p>
        )}
      </div>
    </section>
  );
}
