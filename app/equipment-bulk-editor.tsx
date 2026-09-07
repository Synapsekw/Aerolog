'use client';
import {useState} from 'react';
import {useApp} from './app-provider';
import {api} from '@/lib/supabase-browser';
import {Button} from '@/components/ui/button';
const fields={manufacturer:'Manufacturer',productModel:'Product model',firmware:'Firmware',storageSiteId:'Storage site'};
export default function EquipmentBulkEditor(){
 const app=useApp(),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[field,setField]=useState<keyof typeof fields>('storageSiteId'),[value,setValue]=useState(''),[review,setReview]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 if(!['admin','manager','technician'].includes(app.profile.role))return null;
 const equipment=app.records.filter(r=>['asset','battery'].includes(r.kind));
 const name=(r:any)=>r.data.name||r.data.sourceName||r.data.model||r.id;
 const choices=equipment.filter(r=>(name(r)+' '+(r.data.serial||'')+' '+r.id).toLowerCase().includes(query.toLowerCase()));
 const displayValue=(key:string,v:string)=>!v?'Not set':key==='storageSiteId'?((app.items('site').find(s=>s.id===v)?.name||'Unknown site')+' · '+v):v;
 const sites=app.items('site').filter(s=>!s.archived&&['Storage','Both'].includes(s.purpose));
 return <details className="glass equipment-bulk-editor"><summary>Bulk edit equipment metadata</summary><p>Select up to 100 aircraft, batteries or accessories, then review each change before applying it. Blank values clear the selected field.</p>
  {!review?<><label className="field">Find equipment<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, serial or ID"/></label>
  <div className="kit-candidates">{choices.slice(0,100).map(r=>{const key=r.kind+':'+r.id;return <label key={key}><input type="checkbox" checked={selected.includes(key)} disabled={selected.length>=100&&!selected.includes(key)} onChange={e=>setSelected(e.target.checked?[...selected,key]:selected.filter(k=>k!==key))}/>{name(r)}<small>{r.kind} · {r.data.serial||r.id}</small></label>})}</div>
  <p>{selected.length} selected · {choices.length} matching. Showing the first 100 matches; refine the search for more.</p><Button variant="outline" onClick={()=>setSelected([])}>Clear selection</Button>
  <div className="form-grid"><label className="field">Field<select value={field} onChange={e=>{setField(e.target.value as keyof typeof fields);setValue('')}}>{Object.entries(fields).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label><label className="field">New value{field==='storageSiteId'?<select value={value} onChange={e=>setValue(e.target.value)}><option value="">Clear storage site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>:<input maxLength={field==='productModel'?120:100} value={value} onChange={e=>setValue(e.target.value)}/>}</label></div>
  <Button disabled={!selected.length} onClick={()=>{const rows=equipment.filter(r=>selected.includes(r.kind+':'+r.id));if(rows.length!==selected.length){setError('Some selected equipment is no longer available. Clear the selection and review again.');return;}setError('');setReview({field,value:value.trim(),rows:rows.map(r=>({kind:r.kind,id:r.id,revision:r.revision,name:name(r),before:r.data[field]||''}))})}}>Review changes</Button></>:<>
  <h3>Review {review.rows.length} changes · {fields[review.field as keyof typeof fields]}</h3>
  <div className="report-table-scroll" role="region" aria-label="Bulk equipment change preview" tabIndex={0}><table><thead><tr><th>Equipment</th><th>Current value</th><th>New value</th></tr></thead><tbody>{review.rows.map((r:any)=><tr key={r.kind+':'+r.id}><th scope="row">{r.name}<small>{r.kind} · {r.id}</small></th><td>{displayValue(review.field,r.before)}</td><td>{review.value?displayValue(review.field,review.value):'Clear value'}</td></tr>)}</tbody></table></div>
  <div className="row report-pagination"><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Back to selection</Button><Button disabled={busy||!review.rows.length} onClick={async()=>{setBusy(true);setError('');try{const result=await api('equipment-bulk',{method:'POST',body:JSON.stringify({items:review.rows.map(({kind,id,revision}:any)=>({kind,id,revision})),patch:{[review.field]:review.value}})});setReview(null);setSelected([]);await app.refresh();app.notify(`Updated ${result.updated} equipment records`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>{busy?'Applying…':'Apply reviewed changes'}</Button></div>
  </>}{error&&<p role="alert">{error}</p>}</details>;
}
