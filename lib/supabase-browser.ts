'use client';
import { createClient } from '@supabase/supabase-js';
let activeOrganization = '';
export function setActiveOrganization(id: string) {
  activeOrganization = id;
}
let instance: ReturnType<typeof createClient>;
export function browserClient() {
  if (!instance)
    instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  return instance;
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await browserClient().auth.getSession();
  const response = await fetch('/api/' + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(activeOrganization && path !== 'bootstrap'
        ? { 'X-Aerolog-Organization': activeOrganization }
        : {}),
      Authorization: 'Bearer ' + (session?.access_token || ''),
      ...Object.fromEntries(new Headers(options.headers).entries()),
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw Error(
      body.error +
        (body.details?.length
          ? ' ' +
            body.details.map((d: any) => d.field + ': ' + d.message).join('; ')
          : ''),
    );
  return body;
}
