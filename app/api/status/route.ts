import { requireUser, failure } from '@/lib/server/supabase';
export async function GET(request: Request) {
  try {
    await requireUser(request);
    return Response.json({
      supabase: true,
      mapbox: !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      djiKeyConfigured: !!process.env.DJI_APP_KEY,
      djiType: process.env.DJI_API_TYPE || null,
      djiAccountConfigured:
        !!process.env.DJI_TEST_ACCOUNT_USERNAME &&
        !!process.env.DJI_TEST_ACCOUNT_PASSWORD,
      smtp: !!process.env.SMTP_HOST && !!process.env.SMTP_PASSWORD,
      djiSyncSupported: false,
      djiSyncMessage:
        'A supported historical DJI account-sync API has not been verified. Import flight logs to populate your logbook.',
    });
  } catch (e) {
    return failure(e);
  }
}
