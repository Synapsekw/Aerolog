import { createHash } from 'node:crypto';
import { adminClient } from '@/lib/server/supabase';
import { calendarExport } from '@/lib/operations/calendar-export';
export async function GET(_request: Request, context: {params: Promise<{token:string}>}) {
  const {token}=await context.params;
  const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
  if(!/^[a-f0-9]{64}$/.test(token))return new Response('Calendar unavailable',{status:404,headers});
  const r=await adminClient().rpc('aerolog_calendar_feed',{hash:createHash('sha256').update(token).digest('hex')}).retry(false);
  if(r.error)return new Response('Calendar temporarily unavailable',{status:503,headers});
  if(!r.data)return new Response('Calendar unavailable',{status:404,headers});
  const feed=calendarExport(r.data.entries,{organizationId:r.data.organizationId,from:r.data.from,through:r.data.through,timezone:r.data.timezone,kind:'All'});
  return new Response(feed.content,{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="aerolog-calendar.ics"'}});
}
