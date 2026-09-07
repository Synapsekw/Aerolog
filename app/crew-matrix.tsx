'use client';
import { useState, type ReactNode } from 'react';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { memberFlightTotals } from '@/lib/domain/team';
import { qualificationState } from '@/lib/operations/qualifications';

export default function CrewMatrix({ children, onOpen, onCreate }: { children: ReactNode; onOpen: (id: string) => void; onCreate: (member: { id: string; display_name: string }) => void }) {
  const app = useApp();
  const [view, setView] = useState('Matrix'), [scope, setScope] = useState('Active members'), [query, setQuery] = useState('');
  const people = app.items('crew');
  const totals = memberFlightTotals(app.profiles, app.items('flight')); 
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: app.organization.settings?.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const memberFor = (person: any) => {
    const matches = app.profiles.filter(m => person.authUserId ? m.id === person.authUserId : m.display_name === person.name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const rows = [
    ...people.map(person => ({id: person.id, name: person.name, person, member: memberFor(person)})),
    ...app.profiles.filter(m => !people.some(p => memberFor(p)?.id === m.id)).map(member => ({id: member.id, name: member.display_name, person: null, member})),
  ].filter(r => (scope === 'All personnel' || (scope === 'Active members' ? r.member?.active === true : r.member?.active === false)) && r.name.toLowerCase().includes(query.toLowerCase()));
  const names = [...new Set<string>(people.flatMap(p => (p.qualifications || []).map((q: any) => q.name)))].sort();
  return <section className="crew-matrix-section">
    <div className="row">
      {['Matrix', 'Profile cards'].map(v => <Button key={v} variant={view === v ? 'default' : 'outline'} aria-pressed={view === v} onClick={() => setView(v)}>{v}</Button>)}
    </div>
    {view === 'Profile cards' ? children : <section className="glass operations-catalog">
      <div className="page-heading"><div><h2>Qualifications & aircraft access</h2><p>Recorded credentials as of {today}. Mission approval checks the assigned crew and mission date separately.</p></div></div>
      <div className="form-grid">
        <label className="field">Membership scope<select value={scope} onChange={e => setScope(e.target.value)}>{['Active members', 'Inactive members', 'All personnel'].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="field">Find a person<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names…" /></label>
      </div>
      <div className="report-table-scroll"><table className="crew-matrix"><thead><tr><th scope="col">Person</th><th scope="col">Organization access</th><th scope="col">Logged flights / hours</th><th scope="col">Primary certificate</th><th scope="col">Aircraft permissions</th>{names.map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>
        {rows.map(({id, name, person, member}) => <tr key={id}>
          <th scope="row">{person ? <Button variant="ghost" onClick={() => onOpen(person.id)}>{name}</Button> : name}{!person && <><small>Crew profile not recorded</small>{member?.active && ['admin', 'manager'].includes(app.profile.role) && <Button variant="outline" onClick={() => onCreate(member)}>Set up crew profile</Button>}</>}</th>
          <td>{member ? member.active ? 'Active member' : 'Inactive member' : 'No unique membership link'}</td>
          <td>{member ? <>{totals.byId.get(member.id)?.flights || 0} flights<small>{((totals.byId.get(member.id)?.seconds || 0)/3600).toFixed(2)} h</small></> : 'See crew profile'}</td>
          <td>{!person?.cert || !person?.expires ? 'Not recorded' : <>{person.cert}<small>{person.expires < today ? 'Expired' : 'Valid through'} {person.expires}</small></>}</td>
          <td>{person?.aircraftPermission || 'Not configured'}{person?.aircraftPermission === 'Selected aircraft' && <small>{(person.authorizedAircraftIds || []).length} authorized aircraft</small>}</td>
          {names.map(name => {const entries = (person?.qualifications || []).filter((q: any) => q.name === name);return <td key={name}>{!entries.length ? 'Not recorded' : entries.map((q: any) => {
            const state = qualificationState(q, today), days = Math.floor((Date.parse(q.expires+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
            return <div key={q.id} className="matrix-credential"><strong>{state === 'Current' && days <= 30 ? 'Expires within 30 days' : state}</strong><small>{q.issuer || 'Issuer not recorded'} · {q.expires}</small>{q.requiredForOperations && <small>Required for operations</small>}</div>;
          })}</td>;})}
        </tr>)}
      </tbody></table></div>
      {!rows.length && <p>No people match these filters.</p>}
      {!names.length && <p>No additional qualifications have been recorded. Open a crew profile to add qualifications and evidence.</p>}
      <p className="fine-print">Missing credentials and unconfigured permissions are shown explicitly. Inactive membership preserves historical records and does not grant organization access.</p>
    </section>}
  </section>;
}
