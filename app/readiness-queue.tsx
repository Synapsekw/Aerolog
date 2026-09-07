'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Attention } from '@/lib/operations/readiness';
export default function ReadinessQueue({ entries, onOpen }: { entries: Attention[]; onOpen: (kind:string,id:string)=>void }) {
  const [category,setCategory]=useState('All'),[page,setPage]=useState(0);
  const filtered=entries.filter(e=>category==='All'||e.category===category).sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/5)-1));
  return <section className="glass attention">
    <div className="panel-heading"><h2>Readiness & review</h2><span className="count">{entries.length}</span></div>
    <label className="field">Attention category<select value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}>{['All','Missions','Equipment','Inspections','Crew','Documents'].map(c=><option key={c}>{c}</option>)}</select></label>
    {filtered.slice(currentPage*5,currentPage*5+5).map(e=><button key={e.key} className="attention-item" onClick={()=>onOpen(e.kind,e.id)}><div><h3>{e.title}</h3><p>{e.reason}</p><span>{e.category} · Open record →</span></div></button>)}
    {!filtered.length&&<p>No recorded attention items in this category.</p>}
    {filtered.length>5&&<div className="row"><Button variant="ghost" disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>Previous</Button><span>{currentPage+1} / {Math.ceil(filtered.length/5)}</span><Button variant="ghost" disabled={(currentPage+1)*5>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next</Button></div>}
    <p className="fine-print">Based on recorded data. Mission submission performs its own readiness checks.</p>
  </section>;
}
