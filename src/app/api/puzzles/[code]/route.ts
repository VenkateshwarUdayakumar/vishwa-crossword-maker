import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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
  const { code } = await ctx.params;

  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const body = (await req.json()) as PuzzleUpdate;

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
  return NextResponse.json(data);
}
