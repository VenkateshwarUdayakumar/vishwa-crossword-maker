/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const supabase = getServerSupabase();
    // trivial query to prove DB connectivity (table name can be anything that exists)
    const { error } = await supabase.from('puzzles').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
