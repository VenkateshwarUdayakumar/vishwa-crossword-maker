// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  if (!url || !key) {
    throw new Error('Supabase env not configured');
  }
  // Node runtime – no need for cookies
  return createClient(url, key, { auth: { persistSession: false } });
}
