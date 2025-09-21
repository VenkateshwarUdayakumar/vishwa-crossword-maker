/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


type PuzzleUpdate = {
  title?: string;
  rows?: number;
  cols?: number;
  grid_b64?: string;
  clues?: Record<string, string>;
  rel?: Record<string, string[]>;
  sym?: string;
  grey?: boolean[];
  bubble?: boolean[];
  status?: 'draft' | 'published';
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await ctx.params;
  const code = (raw || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  }

  // Create the client only when actually used (prevents build-time failures)
  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'supabase_not_configured' },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(data, { status: 200 });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await ctx.params;
  const code = (raw || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as PuzzleUpdate | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'supabase_not_configured' },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from('puzzles')
    .update(body)
    .eq('code', code)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'update_failed' },
      { status: 400 }
    );
  }
  return NextResponse.json(data, { status: 200 });
}
