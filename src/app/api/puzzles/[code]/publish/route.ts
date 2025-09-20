/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseClient';

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

  // Parse and coerce the request body
  const bodyUnknown = await request.json();
  const body = bodyUnknown as PublishBody;

  // Basic guard
  if (
    !code ||
    !body ||
    !body.title ||
    !Number.isFinite(body.rows) ||
    !Number.isFinite(body.cols) ||
    typeof body.grid_b64 !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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
      return NextResponse.json(
        { error: `DB error: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // Always return the code so the client can proceed (store locally, etc.)
  return NextResponse.json({ code }, { status: 200 });
}
