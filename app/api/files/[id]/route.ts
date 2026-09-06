import {
  requireUser,
  adminClient,
  failure,
  ApiError,
} from '@/lib/server/supabase';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { client, profile } = await requireUser(request);
    const { id } = await params;
    const { data } = await client
      .from('aerolog_records')
      .select('data')
      .eq('kind', 'attachment')
      .eq('id', id)
      .single();
    if (
      !data ||
      typeof data.data.path !== 'string' ||
      !data.data.path.startsWith(profile.organization_id + '/') ||
      data.data.path.includes('..')
    )
      throw new ApiError('Attachment not found', 404);
    const { data: signed, error } = await adminClient()
      .storage.from('aerolog-files')
      .createSignedUrl(data.data.path, 60, { download: data.data.name });
    if (error) throw new ApiError('Could not prepare file download');
    return Response.json({ url: signed.signedUrl });
  } catch (e) {
    return failure(e);
  }
}
