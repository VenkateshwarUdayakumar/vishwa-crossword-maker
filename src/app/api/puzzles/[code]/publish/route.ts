import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  // guard against missing code
  const code = (params?.code || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // parse payload
  const body = await req.json().catch(() => null);
  if (!body || !body.title || !body.rows || !body.cols || !body.grid_b64) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // only now touch Supabase — if env vars are missing, we return a clear error but build doesn’t fail
  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Supabase not configured' }, { status: 500 });
  }

  // upsert to "puzzles" table (adjust cols to your schema)
  const { error } = await supabase
    .from('puzzles')
    .upsert(
      [{
        code,
        title: body.title,
        rows: body.rows,
        cols: body.cols,
        grid_b64: body.grid_b64,
        clues: body.clues ?? {},
        rel: body.rel ?? {},
        sym: body.sym ?? 'r',
        grey: body.grey ?? null,
        bubble: body.bubble ?? null,
        status: 'published',
      }],
      { onConflict: 'code', ignoreDuplicates: false }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ code }, { status: 200 });
}
