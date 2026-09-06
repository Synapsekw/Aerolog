import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
export async function POST(request: Request) {
  try {
    const { profile, client } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'pilot']);
    const form = await request.formData(),
      file = form.get('file');
    const ids = z
      .array(z.string().min(1).max(100))
      .min(1)
      .max(500)
      .parse(JSON.parse(z.string().parse(form.get('flights'))));
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 25 * 1024 * 1024 ||
      !/\.(txt|csv|json)$/i.test(file.name)
    )
      throw new ApiError('Invalid source file');
    const { data: flights, error } = await client
      .from('aerolog_records')
      .select('id,created_by,data')
      .eq('kind', 'flight')
      .in('id', ids);
    if (error || flights?.length !== new Set(ids).size)
      throw new ApiError('Imported flights not found', 404);
    if (
      profile.role === 'pilot' &&
      flights.some((f) => f.created_by !== profile.id)
    )
      throw new ApiError('Only your own flight sources can be archived', 403);
    const bytes = Buffer.from(await file.arrayBuffer()),
      hash = createHash('sha256').update(bytes).digest('hex'),
      id = 'RAW-' + hash,
      path = profile.organization_id + '/sources/' + id,
      admin = adminClient();
    const { data: existing } = await client
      .from('aerolog_records')
      .select('data')
      .eq('kind', 'attachment')
      .eq('id', id)
      .maybeSingle();
    if (existing) {
      const linked = await admin
        .rpc('aerolog_link_source', {
          actor: profile.id,
          expected_org: profile.organization_id,
          source_id: id,
          flight_ids: [...new Set(ids)],
        })
        .retry(false);
      if (linked.error)
        throw new ApiError(
          linked.error.message,
          linked.error.code === 'PT409' ? 409 : 400,
        );
      return Response.json(linked.data);
    }
    const { error: upload } = await admin.storage
      .from('aerolog-files')
      .upload(path, bytes, { contentType: 'application/octet-stream' });
    if (upload)
      throw new ApiError(
        'Source file archive failed. Saved flight records are retained.',
      );
    const doc = {
      id,
      path,
      name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150),
      size: file.size,
      flights: ids,
      sha256: hash,
      type: 'application/octet-stream',
      source: true,
    };
    const { error: save } = await admin.from('aerolog_records').insert({
      organization_id: profile.organization_id,
      kind: 'attachment',
      id,
      data: doc,
      created_by: profile.id,
    });
    if (save) {
      await admin.storage.from('aerolog-files').remove([path]);
      throw new ApiError('Source archive metadata could not be saved.');
    }
    await admin.from('aerolog_audit').insert({
      organization_id: profile.organization_id,
      actor_id: profile.id,
      actor_name: profile.display_name,
      action: 'flight_source_archived',
      kind: 'attachment',
      record_id: id,
      after_data: { flights: ids, sha256: hash },
    });
    return Response.json(doc);
  } catch (e) {
    return failure(e);
  }
}
