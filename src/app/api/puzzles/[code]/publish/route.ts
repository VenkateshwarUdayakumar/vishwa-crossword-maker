import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- supabase client (server-side) ---
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Service role recommended here because we mutate records regardless of the caller's auth.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { code } = await params;

  if (!UUID_RX.test(code)) {
    return NextResponse.json(
      { error: 'Invalid code (expected puzzle UUID for now).' },
      { status: 400 }
    );
  }

  // Optional body: { rev?: number }
  let desiredRev: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.rev === 'number' && Number.isFinite(body.rev)) {
      desiredRev = Math.trunc(body.rev);
    }
  } catch {
    // ignore bad JSON
  }

  const client = supabase();

  // Ensure puzzle exists first
  const { data: puzzle, error: pErr } = await client
    .from('puzzles')
    .select('id, current_rev')
    .eq('id', code)
    .single();

  if (pErr || !puzzle) {
    return NextResponse.json({ error: 'Puzzle not found.' }, { status: 404 });
  }

  // If rev provided, check it exists
  if (typeof desiredRev === 'number') {
    const { data: revRow, error: rErr } = await client
      .from('puzzle_revisions')
      .select('rev')
      .eq('puzzle_id', code)
      .eq('rev', desiredRev)
      .single();

    if (rErr || !revRow) {
      return NextResponse.json(
        { error: `Revision ${desiredRev} not found for this puzzle.` },
        { status: 400 }
      );
    }
  }

  // Publish + optionally set current_rev
  const update: Record<string, any> = { status: 'published' as const };
  if (typeof desiredRev === 'number') update.current_rev = desiredRev;

  const { error: uErr } = await client
    .from('puzzles')
    .update(update)
    .eq('id', code);

  if (uErr) {
    return NextResponse.json(
      { error: 'Failed to publish puzzle.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: code,
    current_rev: typeof desiredRev === 'number' ? desiredRev : puzzle.current_rev,
    status: 'published',
  });
}

// Optional: reject other methods explicitly
export async function GET() {
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
