import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// naive short code helper
const genCode = () => Math.random().toString(36).slice(2, 10);

export async function POST(req: Request) {
  const body = await req.json(); // { title, rows, cols, symmetry, grid_b64, clues, rel, grey, bubble }
  const code = genCode();

  // For now we insert as published == true for quickest flow; you can insert as draft first if you prefer
  const { data, error } = await supabase
    .from('puzzles')
    .insert([{ 
      owner: null, // if you’re not using auth yet; else set owner via supabase auth user id
      title: body.title ?? 'Untitled Puzzle',
      rows: body.rows ?? 15,
      cols: body.cols ?? 15,
      symmetry: body.symmetry ?? true,
      status: 'published', // or 'draft' if you want two-step flow
      grid_b64: body.grid_b64,
      clues: body.clues ?? {},
      rel: body.rel ?? {},
      grey: body.grey ?? [],
      bubble: body.bubble ?? [],
      code
    }])
    .select('code')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code: data.code });
}
