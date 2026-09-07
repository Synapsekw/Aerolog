import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { requireUser, requireRole, adminClient, ApiError, failure } from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    const {profile}=await requireUser(request);requireRole(profile,['admin','manager']);
    const page=z.coerce.number().int().min(0).max(10000).parse(new URL(request.url).searchParams.get('page') || 0);
    const r=await adminClient().from('aerolog_calendar_shares').select('id,label,date_from,date_to,kinds,created_at,expires_at,revoked_at').eq('organization_id',profile.organization_id).order('created_at',{ascending:false}).order('id').range(page*25,page*25+25);
    if(r.error)throw new ApiError('Could not load calendar shares');
    return Response.json({shares:r.data.slice(0,25),hasMore:r.data.length>25});
  }catch(e){return failure(e)}
}
export async function POST(request: Request) {
  try {
    const {profile}=await requireUser(request);requireRole(profile,['admin','manager']);
    const input=z.discriminatedUnion('action',[
      z.object({action:z.literal('create'),label:z.string().trim().min(1).max(120),from:z.iso.date(),to:z.iso.date(),expiresAt:z.iso.datetime(),kinds:z.array(z.enum(['mission','service','flight'])).min(1).max(3)}),
      z.object({action:z.literal('revoke'),id:z.uuid()}),
    ]).parse(await request.json());
    if(input.action==='create' && input.from>input.to)throw new ApiError('End date must follow start date');
    const token=input.action==='create'?randomBytes(32).toString('hex'):null;
    const document=input.action==='create'?{...input,id:randomUUID(),hash:createHash('sha256').update(token!).digest('hex')}:{id:input.id};
    const result=await adminClient().rpc('aerolog_calendar_share',{actor:profile.id,expected_org:profile.organization_id,action:input.action,document}).retry(false);
    if(result.error)throw new ApiError(result.error.message);
    return Response.json({share:result.data,...(token?{path:'/api/calendar-feed/'+token}: {})});
  }catch(e){return failure(e)}
}
