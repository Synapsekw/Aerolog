import test from 'node:test';
import assert from 'node:assert/strict';
import { memberFlightTotals } from '../lib/domain/team';
import type { Profile, Flight } from '../lib/domain/models';
const members = [
  { id: 'one', display_name: 'Ivan', active: true },
  { id: 'two', display_name: 'Ivan', active: false },
  { id: 'three', display_name: 'Sara', active: true },
] as Profile[];
test('member accounting uses identity even for duplicate names and disabled members', () => {
  const flights = [
    { pilot: 'Old name', pilotUserId: 'two', durationSeconds: 60 },
    { pilot: 'Ivan', durationSeconds: 30 },
    { pilot: 'Sara', durationSeconds: 90 },
    { pilot: 'Sara', pilotUserId: 'external', durationSeconds: 120 },
  ] as Flight[];
  const totals = memberFlightTotals(members, flights);
  assert.deepEqual(totals.byId.get('two'), { flights: 1, seconds: 60 });
  assert.deepEqual(totals.byId.get('three'), { flights: 1, seconds: 90 });
  assert.deepEqual(totals.byId.get('one'), { flights: 0, seconds: 0 });
  assert.equal(totals.unattributed, 2);
});
import { crewFlightTotals } from '../lib/domain/team';
test('crew totals keep renamed and inactive accounts, reject ambiguous names and support external crew',()=>{
 const people=[{id:'c1',name:'New Ivan',authUserId:'two'},{id:'c2',name:'Sara'},{id:'c3',name:'Contractor'}];
 const flights=[{pilot:'Old Ivan',pilotUserId:'two',durationSeconds:60},{pilot:'Sara',durationSeconds:90},{pilot:'Contractor',durationSeconds:30},{pilot:'Sara',pilotUserId:'unknown',durationSeconds:500},{pilot:'Ivan',durationSeconds:100}] as Flight[];
 const totals=crewFlightTotals(people,members,flights);
 assert.deepEqual(totals.byId.get('c1'),{flights:1,seconds:60});
 assert.deepEqual(totals.byId.get('c2'),{flights:1,seconds:90});
 assert.deepEqual(totals.byId.get('c3'),{flights:1,seconds:30});
 assert.equal(totals.unattributed,2);
 assert.equal(crewFlightTotals([...people,{id:'duplicate',name:'Contractor'}],members,flights).byId.get('c3')?.flights,0);
});
