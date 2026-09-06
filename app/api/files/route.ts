import { randomUUID } from 'node:crypto';
import {
  requireUser,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    const { client } = await requireUser(request);
    const mission = new URL(request.url).searchParams.get('mission');
    if (!mission) throw new ApiError('Mission required');
    const { data, error } = await client
      .from('aerolog_records')
      .select('data')
      .eq('kind', 'attachment')
      .eq('data->>mission', mission);
    if (error) throw error;
    return Response.json({ files: data.map((r) => r.data) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { client, profile } = await requireUser(request);
    if (!['admin', 'manager', 'pilot'].includes(profile.role))
      throw new ApiError('Read-only account', 403);
    const form = await request.formData();
    const file = form.get('file'),
      mission = form.get('mission');
    if (!(file instanceof File) || typeof mission !== 'string')
      throw new ApiError('A file and mission are required');
    if (file.size === 0 || file.size > 25 * 1024 * 1024)
      throw new ApiError('Files must be between 1 byte and 25 MB.');
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/plain',
      'text/csv',
      'application/json',
    ];
    if (!allowed.includes(file.type))
      throw new ApiError('Upload a PDF, PNG, JPEG, TXT, CSV, or JSON file.');
    const { data: record } = await client
      .from('aerolog_records')
      .select('*')
      .eq('kind', 'mission')
      .eq('id', mission)
      .single();
    if (!record) throw new ApiError('Mission not found', 404);
    if (!['Draft', 'Changes requested'].includes(record.data.status))
      throw new ApiError('Attachments are locked after submission.');
    if (
      profile.role === 'pilot' &&
      record.created_by !== profile.id &&
      record.data.pilot !== profile.display_name
    )
      throw new ApiError(
        'You may attach documents only to your own missions.',
        403,
      );
    const id = randomUUID(),
      safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150),
      path = profile.organization_id + '/' + mission + '/' + id;
    const admin = adminClient();
    const { error: uploadError } = await admin.storage
      .from('aerolog-files')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new ApiError('File upload failed.');
    const doc = {
      id,
      mission,
      path,
      name: safeName,
      size: file.size,
      type: file.type,
    };
    const { error: insertError } = await client.rpc('aerolog_attach', { doc });
    if (insertError) {
      await admin.storage.from('aerolog-files').remove([path]);
      throw new ApiError(insertError.message);
    }
    return Response.json(doc);
  } catch (e) {
    return failure(e);
  }
}
