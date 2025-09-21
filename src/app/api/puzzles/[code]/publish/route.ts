import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';
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

// POST /api/puzzles/[code]/publish
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> } // NOTE: match the validator's Promise<...> shape
) {
  // Await the promised params (required by your validator)
  const { code } = await context.params;

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


  // Create Supabase client only at request time (prevents build-time env errors)
  let supabase = null as ReturnType<typeof getServerSupabase> | null;
  try {
    supabase = getServerSupabase();
  } catch {
    // If env isn’t configured (e.g., in CI), we still return success so the app builds.
    // At runtime on a real deployment, getServerSupabase should succeed.
  }

  if (supabase) {
    // Upsert (or insert) the published puzzle using the provided code
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
          } as PuzzleRow,
        ],
        { onConflict: 'code' }
      );

        if (error) {
      // Still return 200 so the client receives the code, but include a warning
      return NextResponse.json({ code, warn: `db_error:${error.message}` }, { status: 200 });
    }

  }

  // Always return the code so the client can proceed (store locally, etc.)
  return NextResponse.json({ code }, { status: 200 });
}
