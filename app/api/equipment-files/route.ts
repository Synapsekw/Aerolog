import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  requireUser,
  requireRole,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
const target = z.object({
  targetKind: z.enum(['asset', 'battery']),
  targetId: z.string().min(1).max(100),
});
export async function GET(request: Request) {
  try {
    const { client } = await requireUser(request);
    const input = target.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { data, error } = await client
      .from('aerolog_records')
      .select('data')
      .eq('kind', 'attachment')
      .eq('data->>targetKind', input.targetKind)
      .eq('data->>targetId', input.targetId);
    if (error) throw error;
    return Response.json({ files: data.map((r) => r.data) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { profile, client } = await requireUser(request);
    requireRole(profile, ['admin', 'manager', 'technician']);
    const form = await request.formData(),
      input = target.parse({
        targetKind: form.get('targetKind'),
        targetId: form.get('targetId'),
      }),
      file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 25 * 1024 * 1024
    )
      throw new ApiError('Choose a file between 1 byte and 25 MB');
    if (
      ![
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain',
        'text/csv',
        'application/json',
      ].includes(file.type)
    )
      throw new ApiError('Use PDF, PNG, JPEG, TXT, CSV or JSON');
    const found = await client
      .from('aerolog_records')
      .select('id')
      .eq('kind', input.targetKind)
      .eq('id', input.targetId)
      .single();
    if (!found.data) throw new ApiError('Equipment not found', 404);
    const id = randomUUID(),
      path = profile.organization_id + '/equipment/' + id,
      admin = adminClient();
    const uploaded = await admin.storage
      .from('aerolog-files')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new ApiError('Attachment upload failed');
    const document = {
      id,
      ...input,
      path,
      name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150),
      size: file.size,
      type: file.type,
    };
    const result = await admin
      .rpc('aerolog_equipment_attach', {
        actor: profile.id,
        expected_org: profile.organization_id,
        document,
      })
      .retry(false);
    if (result.error) {
      await admin.storage.from('aerolog-files').remove([path]);
      throw new ApiError(result.error.message);
    }
    return Response.json(document);
  } catch (e) {
    return failure(e);
  }
}
