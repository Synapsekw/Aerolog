import {z} from 'zod';
import {requireUser,requireRole,ApiError,failure} from '@/lib/server/supabase';
export async function POST(request:Request){
 try{
  const {client,profile}=await requireUser(request);requireRole(profile,['admin','manager','technician']);
  const input=z.object({items:z.array(z.object({kind:z.enum(['asset','battery']),id:z.string().min(1).max(100),revision:z.number().int().positive()})).min(1).max(100),patch:z.object({manufacturer:z.string().trim().max(100).optional(),productModel:z.string().trim().max(120).optional(),firmware:z.string().trim().max(100).optional(),storageSiteId:z.string().max(100).optional()}).strict().refine(p=>Object.keys(p).length>0)}).parse(await request.json());
  const result=await client.rpc('aerolog_bulk_equipment_metadata',{items:input.items,patch:input.patch,expected_organization:profile.organization_id}).retry(false);
  if(result.error)throw new ApiError(result.error.message,result.error.code==='PT409'?409:400);
  return Response.json(result.data);
 }catch(e){return failure(e)}
}
