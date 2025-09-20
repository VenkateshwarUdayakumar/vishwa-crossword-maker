import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shape we return to callers (and use for local type narrowing)
type PuzzleRow = {
  id: string;
  owner: string;
  title: string;
  rows: number;
  cols: number;
  symmetry: boolean;
  status: 'draft' | 'published';
  current_rev: number | null;
  created_at: string;
};

type RevisionRow = {
  id: string;
  puzzle_id: string;
  rev: number;
  grid: any;   // jsonb
  clues: any;  // jsonb
  notes: string | null;
  author: string | null;
  created_at: string;
};

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { code } = await params;

  // Treat code as UUID for now
  if (!UUID_RX.test(code)) {
    return NextResponse.json(
      { error: 'Invalid code (expected puzzle UUID for now).' },
      { status: 400 }
    );
  }

  const client = supabase();

  // 1) Fetch the published puzzle
  const { data: puzzleData, error: pErr } = await client
    .from('puzzles')
    .select('*')
    .eq('id', code)
    .eq('status', 'published')
    .single();

  if (pErr || !puzzleData) {
    return NextResponse.json(
      { error: 'Puzzle not found or not published.' },
      { status: 404 }
    );
  }
  const puzzle = puzzleData as PuzzleRow;

  // 2) Get its current or latest revision
  let revNum = puzzle.current_rev ?? null;
  let revision: RevisionRow | null = null;

  if (revNum !== null) {
    const { data: revRow, error: rErr } = await client
      .from('puzzle_revisions')
      .select('*')
      .eq('puzzle_id', puzzle.id)
      .eq('rev', revNum)
      .single();

    if (rErr || !revRow) {
      return NextResponse.json(
        { error: 'Puzzle revision not found.' },
        { status: 404 }
      );
    }
    revision = revRow as RevisionRow;
  } else {
    const { data: revRows, error: rErr2 } = await client
      .from('puzzle_revisions')
      .select('*')
      .eq('puzzle_id', puzzle.id)
      .order('rev', { ascending: false })
      .limit(1);

    if (rErr2 || !revRows || revRows.length === 0) {
      return NextResponse.json(
        { error: 'No revisions found for puzzle.' },
        { status: 404 }
      );
    }
    revision = revRows[0] as RevisionRow;
    revNum = revision.rev;
  }

  return NextResponse.json({
    id: puzzle.id,
    title: puzzle.title,
    rows: puzzle.rows,
    cols: puzzle.cols,
    symmetry: puzzle.symmetry,
    status: puzzle.status,
    rev: revNum,
    grid: revision?.grid ?? null,
    clues: revision?.clues ?? null,
    notes: revision?.notes ?? null,
    created_at: puzzle.created_at,
  });
}

// Explicitly block other methods (keeps validator happy)
export async function POST() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
