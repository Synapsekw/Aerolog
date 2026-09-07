import { requireUser, failure } from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    const { client, profile, user } = await requireUser(request);
    const records: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await client
        .from('aerolog_records')
        .select('*')
        .order('kind')
        .order('id')
        .range(offset, offset + 499);
      if (r.error) throw r.error;
      records.push(...r.data);
      if (r.data.length < 500) break;
    }
    const equipmentAliases: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await client
        .from('aerolog_equipment_aliases')
        .select('kind,source_id,canonical_id')
        .eq('organization_id', profile.organization_id)
        .order('kind')
        .order('source_id')
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      equipmentAliases.push(...result.data);
      if (result.data.length < 500) break;
    }
    const results = await Promise.all([
      client
        .from('aerolog_organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single(),
      Promise.resolve({ data: records, error: null }),
      client
        .from('aerolog_memberships')
        .select('*')
        .eq('organization_id', profile.organization_id),
      client
        .from('aerolog_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      client
        .from('aerolog_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150),
    ]);
    for (const r of results) if (r.error) throw r.error;
    return Response.json({
      profile: { ...profile, email: user.email },
      organization: results[0].data,
      records: results[1].data,
      profiles: (results[2].data || []).map((m: any) => ({
        ...m,
        id: m.user_id,
      })),
      notifications: results[3].data,
      audit: results[4].data,
      equipmentAliases,
    });
  } catch (e) {
    return failure(e);
  }
}
