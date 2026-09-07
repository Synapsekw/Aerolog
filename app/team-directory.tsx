'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Status } from './shared';
import { memberFlightTotals } from '@/lib/domain/team';
import type { Flight, Profile } from '@/lib/domain/models';

export default function TeamDirectory({
  members,
  flights,
  profile,
  onManage,
  onAdd,
}: {
  members: Profile[];
  flights: Flight[];
  profile: Profile;
  onManage: (member: Profile) => void;
  onAdd: () => void;
}) {
  const [search, setSearch] = useState(''),
    [role, setRole] = useState('All'),
    [status, setStatus] = useState('Active'),
    [page, setPage] = useState(0);
  const totals = useMemo(
    () => memberFlightTotals(members, flights),
    [members, flights],
  );
  const visible = members
    .filter(
      (m) =>
        m.display_name.toLowerCase().includes(search.trim().toLowerCase()) &&
        (role === 'All' || m.role === role) &&
        (status === 'All' || m.active === (status === 'Active')),
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const pages = Math.max(1, Math.ceil(visible.length / 12)),
    current = Math.min(page, pages - 1);
  return (
    <section className="glass team-directory">
      <div className="row team-heading">
        <div>
          <span className="eyebrow">ORGANIZATION MEMBERS</span>
          <h2>Team & access</h2>
          <p>
            {members.filter((m) => m.active).length} active ·{' '}
            {members.filter((m) => !m.active).length} disabled
          </p>
        </div>
        {profile.role === 'admin' && (
          <Button variant="outline" onClick={onAdd}>
            Add account
          </Button>
        )}
      </div>
      <div className="team-filters">
        <Input
          aria-label="Search team members"
          placeholder="Search team members…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <label className="field">
          <span>Access role</span>
          <select
            aria-label="Filter team role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(0);
            }}
          >
            {['All', 'admin', 'manager', 'pilot', 'technician', 'observer'].map(
              (r) => (
                <option key={r}>{r}</option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          <span>Membership</span>
          <select
            aria-label="Filter membership status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            {['All', 'Active', 'Disabled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="team-members">
        {visible.slice(current * 12, (current + 1) * 12).map((m) => {
          const total = totals.byId.get(m.id)!;
          return (
            <article className="team-member" key={m.id}>
              <div className="team-member-name">
                <strong>
                  {m.display_name}
                  {m.id === profile.id ? ' (you)' : ''}
                </strong>
                <small>
                  {m.active ? 'Active membership' : 'Disabled membership'}
                </small>
              </div>
              <Status>{m.role}</Status>
              <span className="team-flight-total">
                <strong>{(total.seconds / 3600).toFixed(2)} h</strong>
                <small>{total.flights} recorded flights</small>
              </span>
              {profile.role === 'admin' && m.id !== profile.id && (
                <Button
                  variant="ghost"
                  aria-label={`Manage access for ${m.display_name}`}
                  onClick={() => onManage(m)}
                >
                  Manage access
                </Button>
              )}
            </article>
          );
        })}
      </div>
      {!visible.length && <p role="status">No members match these filters.</p>}
      {pages > 1 && (
        <div className="row">
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span>
            {current + 1} / {pages} · {visible.length} members
          </span>
          <Button
            variant="outline"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <p className="fine-print">
        Flight time belongs to this organization and includes disabled members’
        history. Crew qualifications are managed separately.
        {totals.unattributed > 0
          ? ` ${totals.unattributed} flights have no matching member identity and remain in organization totals.`
          : ''}
      </p>
    </section>
  );
}
