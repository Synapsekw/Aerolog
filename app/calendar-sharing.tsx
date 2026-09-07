'use client';
import {useEffect,useState} from 'react';
import {useApp} from './app-provider';
import {api} from '@/lib/supabase-browser';
import {Button} from '@/components/ui/button';
export default function CalendarSharing({from,to}:{from:string;to:string}) {
 const app=useApp(),[shares,setShares]=useState<any[]>([]),[label,setLabel]=useState('Operations calendar'),[days,setDays]=useState(30),[kinds,setKinds]=useState(['mission']),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const allowed=['admin','manager'].includes(app.profile.role);
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false),[refresh,setRefresh]=useState(0),[loading,setLoading]=useState(false);
 function load(){setRefresh(v=>v+1)}
 useEffect(()=>{
  let stopped=false;setShares([]);setHasMore(false);
  if(allowed){setLoading(true);void api('calendar-shares?page='+page).then(result=>{if(!stopped){setShares(result.shares);setHasMore(result.hasMore)}}).catch(e=>{if(!stopped)setError(e.message)}).finally(()=>{if(!stopped)setLoading(false)})}
  return ()=>{stopped=true};
 },[app.organization.id,allowed,page,refresh]);
 if(!allowed)return null;
 return <details className="calendar-sharing"><summary>Share a calendar subscription</summary>
  <p>Share titles, dates, status and mission duration for {from} through {to}. Anyone with the link can read these entries until expiry or revocation. Crew, equipment details, tracks and attachments are excluded.</p>
  <p className="fine-print">The local server must stay running. A localhost link works only on this computer; remote subscriptions require the later deployment. Calendar apps refresh on their own schedule and may retain previously downloaded entries after revocation.</p>
  <div className="form-grid"><label className="field">Link label<input value={label} onChange={e=>setLabel(e.target.value)} maxLength={120}/></label><label className="field">Expires in days<input type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label></div>
  <div className="row report-pagination">{['mission','service','flight'].map(k=><label key={k}><input type="checkbox" checked={kinds.includes(k)} onChange={e=>setKinds(e.target.checked?[...kinds,k]:kinds.filter(v=>v!==k))}/> {k==='mission'?'Missions':k==='service'?'Maintenance':'Flight logs'}</label>)}</div>
  <Button disabled={busy||!kinds.length||!label.trim()||!Number.isInteger(days)||days<1||days>365} onClick={async()=>{setBusy(true);setError('');try{const result=await api('calendar-shares',{method:'POST',body:JSON.stringify({action:'create',label,from,to,kinds,expiresAt:new Date(Date.now()+days*86400000).toISOString()})});setLink(window.location.origin+result.path);setPage(0);load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Create subscription link</Button>
  {link&&<label className="field">New subscription URL — copy before leaving<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
  {error&&<p role="alert">{error}</p>}
  {loading&&<p role="status">Loading calendar links…</p>}
  {shares.map(s=><article className="inspection-rule" key={s.id}><strong>{s.label}</strong><p>{s.date_from} → {s.date_to} · {s.kinds.join(', ')} · {s.revoked_at?'Revoked':new Date(s.expires_at).getTime()<Date.now()?'Expired':'Active'} · expires {s.expires_at}</p>{!s.revoked_at&&<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{await api('calendar-shares',{method:'POST',body:JSON.stringify({action:'revoke',id:s.id})});setLink('');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Revoke link</Button>}</article>)}
  {!loading&&!shares.length&&<p>No calendar links on this page.</p>}
  <nav className="row report-pagination" aria-label="Calendar link pages"><Button variant="outline" disabled={loading||busy||page===0} onClick={()=>setPage(page-1)}>Newer links</Button><span>Page {page+1}</span><Button variant="outline" disabled={loading||busy||!hasMore} onClick={()=>setPage(page+1)}>Older links</Button><Button variant="outline" disabled={loading||busy} onClick={load}>Refresh links</Button></nav>
 </details>;
}
