'use client';
import { useState } from 'react';
import MissionMap from './mission-map';
import { useApp } from './app-provider';
import { Button } from '@/components/ui/button';
import { flightSamples } from '@/lib/flight/analysis';
import { compareBoundary } from '@/lib/operations/flight-boundary';
export default function MissionFlightComparison({ mission, onFlight }: {mission:any;onFlight:(id:string)=>void}) {
  const app=useApp(), linked=app.items('flight').filter(f=>f.missionId===mission.id);
  const [selected,setSelected]=useState('');
  const flight=linked.find(f=>f.id===selected)||linked[0];
  const samples=flight?flightSamples(flight).samples:[];
  const track=samples.map(p=>[p.longitude,p.latitude] as [number,number]);
  const boundary=mission.geometry||[];
  const comparison=compareBoundary(boundary,track);
  return <section className="mission-flight-comparison">
    <h3>Planned area & recorded flight</h3>
    {!!linked.length&&<label className="field">Linked flight<select value={flight?.id||''} onChange={e=>setSelected(e.target.value)}>{linked.map(f=><option key={f.id} value={f.id}>{f.date||'Undated'} · {f.mission||f.id} · {f.id}</option>)}</select></label>}
    <MissionMap key={mission.id+':'+(flight?.id||'planned')} points={boundary} track={track} height={340}/>
    <p>Lime: mission boundary · cyan: recorded flight track</p>
    {!linked.length ? <p>No flights are linked to this mission ID. Link a flight through its mission field to compare the recorded track.</p> : <>
      <p>{comparison.available ? `${comparison.outside} of ${comparison.total} recorded positions outside the mission area` : comparison.reason}</p>
      <Button variant="outline" onClick={()=>onFlight(flight.id)}>Open full flight analysis</Button>
    </>}
    <p className="fine-print">This compares recorded horizontal positions with the mission boundary. Points on the boundary count as inside. It does not establish time outside, detect every crossing between samples, or assess airspace compliance. Altitude limits are not compared because KML heights and mission heights may use different reference levels.</p>
  </section>;
}
