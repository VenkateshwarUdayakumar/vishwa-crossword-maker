// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side client. Call this inside a server file/route/page when you need it.
 * Prefers service role key, falls back to anon/public keys for read-only ops.
 */
export function getServerSupabase(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Throw on use (not at module import) so CI/build doesn’t explode
    throw new Error('Supabase env vars are missing (SUPABASE_URL and a key).');
  }
  return createClient(url, key);
}

/**
 * Browser (client) singleton. Only call this from components with 'use client'.
 */
let browserClient: SupabaseClient | null = null;
export function getClientSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getClientSupabase() must be called in the browser.');
  }
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // Create a harmless dummy that will fail when used, but don’t crash import
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    browserClient = createClient(url, key);
  }
  return browserClient;
}

/**
 * Compatibility export for code that does: `import { supabase } from '@/lib/supabaseClient'`
 * We lazily create it so importing the module doesn’t throw in CI when envs aren’t set.
 */
export const supabase: SupabaseClient | undefined =
  typeof window === 'undefined'
    ? (() => {
        try {
          return getServerSupabase();
        } catch {
          // Return undefined so callers can swap to getServerSupabase(),
          // but importing this module won’t explode during build.
          return undefined as unknown as SupabaseClient;
        }
      })()
    : undefined;
