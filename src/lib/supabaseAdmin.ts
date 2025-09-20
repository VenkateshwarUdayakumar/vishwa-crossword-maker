import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; // service role key

  if (!url || !key) {
    throw new Error('Supabase admin not configured: missing env vars.');
  }

  if (_admin) return _admin;

  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}
