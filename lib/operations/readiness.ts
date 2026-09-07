import { qualificationState } from './qualifications';
export type Attention = { key: string; category: string; title: string; reason: string; kind: string; id: string; priority: number };
export function personnelDocumentAttention(crew: any[], members: any[], documents: any[], today: string): Attention[] {
  const result: Attention[] = [];
  const days = (date: string) => (Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  for (const person of crew) {
    const links = members.filter(m => person.authUserId ? m.id === person.authUserId : m.display_name === person.name);
    if (person.status === 'Inactive' || links.some(m => !m.active)) continue;
    const add = (key: string, reason: string, priority = 1) => result.push({key: 'crew:'+person.id+':'+key, category: 'Crew',title:person.name,reason,kind:'crew',id:person.id,priority});
    if (!person.cert || !person.expires) add('certificate','Primary certificate not recorded');
    else if (days(person.expires) <= 30) add('certificate', (days(person.expires) < 0 ? 'Certificate expired: ' : 'Certificate expires: ') + person.expires, days(person.expires) < 0 ? 0 : 2);
    if (!person.aircraftPermission || person.aircraftPermission === 'Not configured') add('aircraft','Aircraft permissions not configured');
    for (const q of person.qualifications || []) {
      const state = qualificationState(q,today);
      if (state !== 'Current' || days(q.expires) <= 30) add(q.id,q.name+' · '+(state === 'Current' ? 'Expires '+q.expires : state),state === 'Expired' ? 0 : 2);
    }
  }
  for (const d of documents.filter(d => !d.archived)) {
    let reason = '', priority = 2;
    if (d.expires && days(d.expires) < 0) {reason='Expired '+d.expires;priority=0;}
    else if(d.status === 'Pending approval') {reason='Awaiting document approval';priority=1;}
    else if(d.expires && days(d.expires) <= 30) reason='Expires '+d.expires;
    if(reason) result.push({key:'document:'+d.id,category:'Documents',title:d.name,reason,kind:'document',id:d.id,priority});
  }
  return result;
}
