import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

type PublishPayload = {
  title: string;
  rows: number;
  cols: number;
  grid_b64: string;
  clues: Record<string, string>;
  rel?: Record<string, string[]>;
  sym?: string;
  grey?: boolean[];
  bubble?: boolean[];
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const payload = (await req.json()) as PublishPayload;

  // upsert or mark as published
  const { data, error } = await supabase
    .from('puzzles')
    .upsert(
      {
        code,
        title: payload.title,
        rows: payload.rows,
        cols: payload.cols,
        grid_b64: payload.grid_b64,
        clues: payload.clues,
        rel: payload.rel ?? {},
        sym: payload.sym ?? 'r',
        grey: payload.grey ?? null,
        bubble: payload.bubble ?? null,
        status: 'published',
      },
      { onConflict: 'code' }
    )
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'publish_failed' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, code });
}
