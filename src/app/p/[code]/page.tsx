/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getClientSupabase } from '@/lib/supabaseClient';

/* =========================
   Types & constants
========================= */

type DBPuzzle = {
  title: string;
  rows: number;
  cols: number;
  grid_b64: string | null;
  clues: Record<string, string> | null;
  sym?: string | null;
};

type SharedWork = {
  id: string; // we’ll use the code as the stable id
  title: string;
  size: number;
  sym: string;
  gridB64: string;
  blocks: boolean[];
  fills: string[];
  clues: Record<string, string>;
  rel: Record<string, string[]>;
  grey?: boolean[];
  bubble?: boolean[];
  updatedAt: number;
  lastOpenedAt?: number;
  code?: string;
  firstSolveMs?: number;
};

const SHARED_KEY = 'works-external';

/* =========================
   Local helpers
========================= */

function decodeGrid(b64: string, rows: number, cols: number): boolean[] {
  if (!b64) return Array(rows * cols).fill(false);
  try {
    const bin = atob(b64);
    if (bin.length !== rows * cols) return Array(rows * cols).fill(false);
    return Array.from(bin, (ch) => ch === '1');
  } catch {
    return Array(rows * cols).fill(false);
  }
}

function ensureSharedListedFromData(code: string, data: DBPuzzle) {
  const raw = localStorage.getItem(SHARED_KEY) ?? '[]';
  const list = JSON.parse(raw) as SharedWork[];

  let w = list.find((x) => x.id === code);
  if (w) {
    w.lastOpenedAt = Date.now();
    w.updatedAt = w.updatedAt || Date.now();
    localStorage.setItem(SHARED_KEY, JSON.stringify(list));
    return w;
  }

  const size = data.rows; // if non-square, we still store rows here (works UI is tolerant)
  const sym = (data.sym ?? 'r').toString();
  const gridB64 = data.grid_b64 ?? '';
  const blocks = decodeGrid(gridB64, data.rows, data.cols);

  w = {
    id: code,
    code,
    title: data.title || `Shared ${code}`,
    size,
    sym,
    gridB64,
    blocks,
    fills: Array(data.rows * data.cols).fill(''),
    clues: data.clues ?? {},
    rel: {},
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
  };

  list.push(w);
  localStorage.setItem(SHARED_KEY, JSON.stringify(list));
  return w;
}

/**
 * Call this once when the solver completes the puzzle on the /p/{code} page.
 * Store the first solve time (ms) inside the Shared-with-you entry.
 */
export function recordSharedFirstSolve(code: string, elapsedMs: number) {
  const raw = localStorage.getItem(SHARED_KEY) ?? '[]';
  const list = JSON.parse(raw) as SharedWork[];
  const ix = list.findIndex((x) => x.id === code);
  if (ix < 0) return;
  if (!list[ix].firstSolveMs || list[ix].firstSolveMs! <= 0) {
    list[ix].firstSolveMs = Math.max(0, Math.floor(elapsedMs));
    list[ix].updatedAt = Date.now();
    localStorage.setItem(SHARED_KEY, JSON.stringify(list));
  }
}

/* =========================
   Page component
========================= */

export default function Page() {
  const params = useParams();
  const code =
    typeof params.code === 'string'
      ? params.code
      : Array.isArray(params.code)
      ? params.code[0]
      : '';

  const [data, setData] = useState<DBPuzzle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  // Fetch the published puzzle client-side (so we can also use localStorage)
  useEffect(() => {
    let cancelled = false;

    async function fetchPuzzle() {
      setLoading(true);
      setClientError(null);

      let supabase;
      try {
        supabase = getClientSupabase();
      } catch (e: any) {
        // Missing NEXT_PUBLIC_* envs will throw here; show a friendly message
        setClientError(e?.message || 'Supabase client is not configured.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('puzzles')
        .select('title, rows, cols, grid_b64, clues, sym')
        .eq('code', code)
        .eq('status', 'published')
        .maybeSingle<DBPuzzle>();

      if (cancelled) return;

      if (error || !data) {
        setNotFound(true);
        setData(null);
        setLoading(false);
        return;
      }

      setData(data);
      setNotFound(false);
      setLoading(false);

      // Ensure it appears in "Shared with you"
      try {
        ensureSharedListedFromData(code, data);
      } catch {
        // best-effort; ignore localStorage errors
      }
    }

    if (code) fetchPuzzle();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const blocks = useMemo(
    () => (data ? decodeGrid(data.grid_b64 ?? '', data.rows, data.cols) : []),
    [data]
  );

  if (!code) {
    return <main className="p-6 text-white">Invalid link.</main>;
  }
  if (loading) {
    return <main className="p-6 text-white">Loading…</main>;
  }
  if (clientError) {
    return (
      <main className="p-6 text-white">
        <p className="text-red-300">Supabase error: {clientError}</p>
      </main>
    );
  }
  if (notFound || !data) {
    return <main className="p-6 text-white">Not found.</main>;
  }

  return (
    <main className="p-6 text-white">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      <p className="text-sm text-zinc-400">
        {data.rows}×{data.cols}
      </p>

      {/* Temporary bare grid (replace with your interactive UI later) */}
      <div
        className="mt-4 grid gap-px bg-zinc-700"
        style={{ gridTemplateColumns: `repeat(${data.cols}, 24px)` }}
      >
        {blocks.map((b, i) => (
          <div key={i} className={b ? 'bg-zinc-900' : 'bg-white'} style={{ width: 24, height: 24 }} />
        ))}
      </div>

      {/* When you wire in an interactive solver here, call:
          recordSharedFirstSolve(code, finalElapsedMs);
          exactly once when the solver completes the puzzle. */}
    </main>
  );
}
