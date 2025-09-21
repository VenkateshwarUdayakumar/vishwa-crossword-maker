'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type ClueMap = Record<string, string>;
type RelMap  = Record<string, string[]>;
type Work = {
  id: string;
  title: string;
  size: number;
  sym: string;
  gridB64: string;
  blocks: boolean[];
  fills: string[];
  clues: ClueMap;
  rel: RelMap;
  grey?: boolean[];
  bubble?: boolean[];
  updatedAt: number;
  code?: string;
  firstSolveMs?: number;
};

const SHARED_KEY = 'works-external' as const;

function readShared(): Work[] {
  try { return JSON.parse(localStorage.getItem(SHARED_KEY) ?? '[]') as Work[]; } catch { return []; }
}
function writeShared(list: Work[]) {
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(list)); } catch {}
}

function decodeGrid(b64: string, size: number): boolean[] {
  if (!b64) return Array(size * size).fill(false);
  try {
    const bin = atob(b64);
    if (bin.length !== size * size) return Array(size * size).fill(false);
    return Array.from(bin, ch => ch === '1');
  } catch { return Array(size * size).fill(false); }
}

export default function PublicPuzzlePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [work, setWork] = useState<Work | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/puzzles/${encodeURIComponent(code)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? 'not_found');

        const rows = json.rows as number;
        const cols = json.cols as number;
        const size = rows === cols ? rows : Math.max(rows, cols);
        const gridB64 = json.grid_b64 as string;
        const clues = (json.clues ?? {}) as ClueMap;
        const rel   = (json.rel ?? {}) as RelMap;
        const sym   = (json.sym ?? 'r') as string;
        const grey  = Array.isArray(json.grey)   ? (json.grey as boolean[])   : undefined;
        const bubble= Array.isArray(json.bubble) ? (json.bubble as boolean[]) : undefined;

        const blocks = decodeGrid(gridB64, size);
        const w: Work = {
          id: `shared-${code}-${Date.now()}`,
          title: String(json.title ?? 'Untitled'),
          size,
          sym,
          gridB64,
          blocks,
          fills: Array(size * size).fill(''),
          clues,
          rel,
          grey,
          bubble,
          updatedAt: Date.now(),
          code: String(code),
        };

        if (!alive) return;

        setWork(w);

        // Save/replace in “Shared with you” by code+title (no duplicates)
        const list = readShared();
        const filtered = list.filter(x => !(x.code === w.code && x.title.trim() === w.title.trim()));
        filtered.unshift(w);
        writeShared(filtered);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [code]);

  if (loading) return <main className="min-h-screen bg-black text-white p-8">Loading…</main>;
  if (err) return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="text-red-300">Failed to open code: {String(code)}</div>
      <div className="text-zinc-400 text-sm mt-2">{err}</div>
    </main>
  );
  if (!work) return null;

  // Simple read-only preview + “Start solving” button that navigates to a solver route if you have one
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold">{work.title}</h1>
      <p className="text-zinc-400 mt-1">Code: <span className="font-mono">{work.code}</span> · {work.size}×{work.size}</p>

      <div className="mt-6">
        <button
          onClick={() => router.push(`/demo/${encodeURIComponent(work.id)}`)}
          className="rounded-md bg-indigo-500 hover:bg-indigo-400 px-4 py-2"
        >
          Start solving (local)
        </button>
        <button
          onClick={() => router.push('/works')}
          className="ml-3 underline text-indigo-300"
        >
          Go to Works
        </button>
      </div>
    </main>
  );
}
