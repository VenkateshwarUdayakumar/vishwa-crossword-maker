// src/lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 * Do NOT import this from client components.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin() must only be called on the server.');
  }

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL; // allow fallback if you only set the public one

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ correct env var name

  if (!url || !key) {
    throw new Error('Supabase admin not configured: missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (_admin) return _admin;

  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}
