import { createClient, SupabaseClient } from '@supabase/supabase-js';

const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  '';

const KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

/**
 * Use inside server handlers. Throws only when actually called,
 * not at module import time—so builds won’t fail if env is missing.
 */
export function getServerSupabase(): SupabaseClient {
  if (!URL || !KEY) {
    throw new Error(
      'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_ equivalents).'
    );
  }
  return createClient(URL, KEY, { auth: { persistSession: false } });
}
