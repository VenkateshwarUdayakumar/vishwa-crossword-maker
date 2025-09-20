import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

// Optional: a tiny helper to make a short code if you ever need it here
const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/**
 * GET /api/puzzles  — return a tiny list (for diagnostics)
 */
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('puzzles')
      .select('code,title,status')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 });
  }
}

/**
 * POST /api/puzzles — optional stub (not required by your flow).
 * Keeps build happy if someone hits it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = getServerSupabase();
    const code = (body?.code as string) || genCode();

    const { error } = await supabase.from('puzzles').insert({
      code,
      title: body?.title ?? 'Untitled',
      status: body?.status ?? 'draft',
      rows: body?.rows ?? 15,
      cols: body?.cols ?? 15,
      grid_b64: body?.grid_b64 ?? null,
      clues: body?.clues ?? {},
      sym: body?.sym ?? 'r',
    });

    if (error) throw error;
    return NextResponse.json({ code }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 });
  }
}
