import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
const supabase = getSupabaseAdmin();
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


// Shape of the expected request body
type PublishBody = {
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

// Minimal row type for your `puzzles` table
type PuzzleRow = {
  code: string;
  title: string;
  status: 'draft' | 'published';
  rows: number;
  cols: number;
  grid_b64: string | null;
  clues: Record<string, string> | null;
  rel: Record<string, string[]> | null;
  sym: string | null;
  grey: boolean[] | null;
  bubble: boolean[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function POST(
  request: NextRequest,
  context: { params: { code: string } }
) {
  const { code: raw } = context.params;
  const code = (raw || '').trim().toUpperCase();

  let body: PublishBody | null = null;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (
    !code ||
    !body ||
    typeof body.title !== 'string' ||
    !Number.isFinite(body.rows as number) ||
    !Number.isFinite(body.cols as number) ||
    typeof body.grid_b64 !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  

  const { error } = await supabase
    .from('puzzles')
    .upsert(
      [
        {
          code,
          title: body.title,
          status: 'published',
          rows: body.rows,
          cols: body.cols,
          grid_b64: body.grid_b64,
          clues: body.clues ?? {},
          rel: body.rel ?? {},
          sym: body.sym ?? 'r',
          grey: Array.isArray(body.grey) ? body.grey : null,
          bubble: Array.isArray(body.bubble) ? body.bubble : null,
        },
      ],
      { onConflict: 'code' }
    );

  if (error) {
    return NextResponse.json({ error: `db_error:${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ code }, { status: 201 });
}

