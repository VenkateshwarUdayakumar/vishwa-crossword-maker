'use client';

// TOP OF FILE — add this import
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  lastOpenedAt?: number;
  // NEW (shared/published glue)
  code?: string;          // /p/{code}
  firstSolveMs?: number;  // your first completion time on /p/{code}
};

// Minimal “published” item (local index)
type PublishedMeta = {
  code: string;   // /p/{code}
  title: string;
  rows: number;
  cols: number;
  createdAt?: number;
};

const SAVED_KEY = 'works-completed' as const;   // legacy name: still where “Saved” live
const PUBLISHED_KEY = 'works-published' as const;
const SHARED_KEY = 'works-external' as const;   // friendlier label in UI
const DRAFTS_KEY = 'works-drafts' as const;


/* ---------------------------- tiny utils ---------------------------- */
const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleString() : '—');
const isArray = Array.isArray;

function readSaved(): Work[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list = raw ? (JSON.parse(raw) as Work[]) : [];
    return isArray(list) ? list : [];
  } catch { return []; }
}
function writeSaved(list: Work[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch {}
}
function readPublished(): PublishedMeta[] {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    const list = raw ? (JSON.parse(raw) as PublishedMeta[]) : [];
    return isArray(list) ? list : [];
  } catch { return []; }
}
function writePublished(list: PublishedMeta[]) {
  try { localStorage.setItem(PUBLISHED_KEY, JSON.stringify(list)); } catch {}
}
function readShared(): Work[] {
  try {
    const raw = localStorage.getItem(SHARED_KEY);
    const list = raw ? (JSON.parse(raw) as Work[]) : [];
    return isArray(list) ? list : [];
  } catch { return []; }
}
function writeShared(list: Work[]) {
  try { localStorage.setItem(SHARED_KEY, JSON.stringify(list)); } catch {}
}
function readDrafts(): Work[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const list = raw ? (JSON.parse(raw) as Work[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function writeDrafts(list: Work[]) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(list)); } catch {}
}


function fmtDuration(ms?: number) {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

/* ================================================================== */

export default function WorksPage() {
  const router = useRouter();

  // Renamed buckets
  const [saved, setSaved] = useState<Work[] | null>(null);
  const [published, setPublished] = useState<PublishedMeta[] | null>(null);
  const [shared, setShared] = useState<Work[] | null>(null);
  const [drafts, setDrafts] = useState<Work[] | null>(null);


 useEffect(() => {
  setSaved(readSaved());
  setPublished(readPublished());
  setShared(readShared());
  setDrafts(readDrafts());

  // Optional: migrate legacy published key if you ever used it
  try {
    const legacy = localStorage.getItem('published-list');
    if (legacy && !localStorage.getItem(PUBLISHED_KEY)) {
      localStorage.setItem(PUBLISHED_KEY, legacy);
      setPublished(readPublished());
    }
  } catch {}
}, []);


const loading = saved === null || published === null || shared === null || drafts === null;


  const sortedSaved = useMemo(
    () => (saved ?? []).slice().sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)),
    [saved]
  );
  const sortedPublished = useMemo(
    () => (published ?? []).slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).reverse(),
    [published]
  );
  const sortedShared = useMemo(
    () => (shared ?? []).slice().sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)),
    [shared]
  );
  const sortedDrafts = useMemo(
  () => (drafts ?? []).slice().sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt)),
  [drafts]
);

const setDraftsList = useCallback((list: Work[]) => {
  setDrafts(list.slice());
  writeDrafts(list);
}, []);


  const setSavedList = useCallback((list: Work[]) => {
    setSaved(list.slice());
    writeSaved(list);
  }, []);
  const setPublishedList = useCallback((list: PublishedMeta[]) => {
    setPublished(list.slice());
    writePublished(list);
  }, []);
  const setSharedList = useCallback((list: Work[]) => {
    setShared(list.slice());
    writeShared(list);
  }, []);

  /* ------------------------- open / delete ops ------------------------- */
  const openSavedWork = useCallback((w: Work) => {
    const now = Date.now();
    if (saved) {
      const list = saved.map((x) => (x.id === w.id ? { ...x, lastOpenedAt: now } : x));
      setSaved(list);
      writeSaved(list);
    }
    router.push(`/create/prompts?size=${w.size}&sym=${w.sym}&grid=${encodeURIComponent(w.gridB64)}`);
  }, [saved, router]);

  const deleteSavedWork = useCallback((w: Work) => {
    if (!confirm(`Delete "${w.title}" from Saved? This cannot be undone.`)) return;
    if (!saved) return;
    setSavedList(saved.filter((x) => x.id !== w.id));
  }, [saved, setSavedList]);
  const openDraftWork = useCallback((w: Work) => {
  const now = Date.now();
  if (drafts) {
    const list = drafts.map((x) => (x.id === w.id ? { ...x, lastOpenedAt: now } : x));
    setDrafts(list);
    writeDrafts(list);
  }
  router.push(`/create/prompts?size=${w.size}&sym=${w.sym}&grid=${encodeURIComponent(w.gridB64)}`);
}, [drafts, router]);

const deleteDraftWork = useCallback((w: Work) => {
  if (!confirm(`Delete draft "${w.title}"? This cannot be undone.`)) return;
  if (!drafts) return;
  setDraftsList(drafts.filter((x) => x.id !== w.id));
}, [drafts, setDraftsList]);


  const openSharedWork = useCallback((w: Work) => {
    const now = Date.now();
    if (shared) {
      const list = shared.map((x) => (x.id === w.id ? { ...x, lastOpenedAt: now } : x));
      setShared(list);
      writeShared(list);
    }
    // Open the public page by code if present; otherwise fallback to prompts
    if (w.code) {
      router.push(`/p/${w.code}`);
    } else {
      router.push(`/create/prompts?size=${w.size}&sym=${w.sym}&grid=${encodeURIComponent(w.gridB64)}`);
    }
  }, [shared, router]);

  const deleteSharedWork = useCallback((w: Work) => {
    if (!confirm(`Remove "${w.title}" from Shared with you? This cannot be undone.`)) return;
    if (!shared) return;
    setSharedList(shared.filter((x) => x.id !== w.id));
  }, [shared, setSharedList]);

  const openPublished = useCallback((p: PublishedMeta) => {
    router.push(`/p/${p.code}`);
  }, [router]);

  const deletePublished = useCallback((p: PublishedMeta) => {
    if (!confirm(`Remove "${p.title}" from Published list? (Does not delete the live puzzle.)`)) return;
    if (!published) return;
    setPublishedList(published.filter((x) => x.code !== p.code));
  }, [published, setPublishedList]);

  /* ------------------------------ render ------------------------------ */
  const renderSaved = useCallback((items: Work[] | null) => {
    if (loading) return <div className="text-zinc-400">Loading…</div>;
    if (!items || items.length === 0) return <div className="text-zinc-500 text-sm">No saved puzzles yet.</div>;
    return (
      <div className="grid gap-3">
        {items.map((w) => {
          const hasGrey = !!(w.grey && w.grey.some(Boolean));
          const hasBubble = !!(w.bubble && w.bubble.some(Boolean));
          return (
            <div key={w.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{w.title}</div>
                <div className="text-sm text-zinc-400 flex items-center gap-2">
                  <span>{w.size}×{w.size} · Sym: <span className="font-mono">{w.sym}</span></span>
                  {(hasGrey || hasBubble) && (
                    <span className="text-xs text-zinc-300">
                      {hasGrey && <span className="mr-2 px-1.5 py-0.5 rounded bg-zinc-700/60">grey</span>}
                      {hasBubble && <span className="px-1.5 py-0.5 rounded bg-zinc-700/60">bubble</span>}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Last opened: {fmt(w.lastOpenedAt)} · Last saved: {fmt(w.updatedAt)}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openSavedWork(w)} className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800">
                  Open
                </button>
                <button onClick={() => deleteSavedWork(w)} className="rounded-md border border-red-700 text-red-300 px-3 py-1 hover:bg-red-900/30">
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [deleteSavedWork, loading, openSavedWork]);
  const renderDrafts = useCallback((items: Work[] | null) => {
  if (loading) return <div className="text-zinc-400">Loading…</div>;
  if (!items || items.length === 0) return <div className="text-zinc-500 text-sm">No drafts yet.</div>;
  return (
    <div className="grid gap-3">
      {items.map((w) => (
        <div key={w.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex items-center justify-between">
          <div>
            <div className="font-medium">{w.title}</div>
            <div className="text-sm text-zinc-400">
              {w.size}×{w.size} · Sym: <span className="font-mono">{w.sym}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Last opened: {fmt(w.lastOpenedAt)} · Last saved: {fmt(w.updatedAt)}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openDraftWork(w)} className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800">
              Open
            </button>
            <button onClick={() => deleteDraftWork(w)} className="rounded-md border border-red-700 text-red-300 px-3 py-1 hover:bg-red-900/30">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}, [deleteDraftWork, loading, openDraftWork]);


  const renderPublished = useCallback((items: PublishedMeta[] | null) => {
    if (loading) return <div className="text-zinc-400">Loading…</div>;
    if (!items || items.length === 0) {
      return <div className="text-zinc-500 text-sm">Nothing published yet. Publish a puzzle to get a shareable code here.</div>;
    }
    return (
      <div className="grid gap-3">
        {items.map((p) => (
          <div key={p.code} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-zinc-400">
                {p.rows}×{p.cols} · Code: <span className="font-mono">{p.code}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">Published: {fmt(p.createdAt)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openPublished(p)} className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800">
                Open
              </button>
              <button onClick={() => deletePublished(p)} className="rounded-md border border-red-700 text-red-300 px-3 py-1 hover:bg-red-900/30">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [deletePublished, loading, openPublished]);

  const renderShared = useCallback((items: Work[] | null) => {
    if (loading) return <div className="text-zinc-400">Loading…</div>;
    if (!items || items.length === 0) return <div className="text-zinc-500 text-sm">No shared puzzles yet.</div>;
    return (
      <div className="grid gap-3">
        {items.map((w) => (
          <div key={w.id} className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{w.title}</div>
              <div className="text-sm text-zinc-400">
                {w.size}×{w.size} · Sym: <span className="font-mono">{w.sym}</span>
                {w.code && <> · Code: <span className="font-mono">{w.code}</span></>}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                First solve: <span className="font-mono">{fmtDuration(w.firstSolveMs)}</span> · Last opened: {fmt(w.lastOpenedAt)}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openSharedWork(w)} className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800">
                Open
              </button>
              <button onClick={() => deleteSharedWork(w)} className="rounded-md border border-red-700 text-red-300 px-3 py-1 hover:bg-red-900/30">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [deleteSharedWork, loading, openSharedWork]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Your puzzles</h1>
        <p className="text-zinc-400 mt-1">Saved locally, published links, and puzzles shared with you.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-4">
{/* Drafts */}
<section className="min-h-[60vh] max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-800">
  <header className="sticky top-0 z-20 bg-black border-b border-zinc-800 rounded-t-lg px-4 py-3">
    <h2 className="text-lg font-semibold">Drafts</h2>
    <p className="text-xs text-zinc-500">Works in progress saved on this device.</p>
  </header>
  <div className="p-4">
    {renderDrafts(sortedDrafts)}
  </div>
</section>

          {/* Saved */}
          <section className="min-h-[60vh] max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-800">
            <header className="sticky top-0 z-20 bg-black border-b border-zinc-800 rounded-t-lg px-4 py-3">
                  <h2 className="text-lg font-semibold">Completed</h2>
              <p className="text-xs text-zinc-500">Your finished puzzles stored on this device.</p>
            </header>
            <div className="p-4">
              {renderSaved(sortedSaved)}
            </div>
          </section>

          {/* Published */}
          <section className="min-h-[60vh] max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-800">
            <header className="sticky top-0 z-20 bg-black border-b border-zinc-800 rounded-t-lg px-4 py-3">
              <h2 className="text-lg font-semibold">Published</h2>
              <p className="text-xs text-zinc-500">Shareable links you’ve published.</p>
            </header>
            <div className="p-4">
              {renderPublished(sortedPublished)}
            </div>
          </section>

          {/* Shared with you */}
          <section className="min-h-[60vh] max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-800">
            <header className="sticky top-0 z-20 bg-black border-b border-zinc-800 rounded-t-lg px-4 py-3">
              <h2 className="text-lg font-semibold">Shared with you</h2>
              <p className="text-xs text-zinc-500">Puzzles friends sent you (local for now).</p>
            </header>
            <div className="p-4">
              {renderShared(sortedShared)}
            </div>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block underline text-indigo-300">
  ← Back to home
</Link>
      </div>
    </main>
  );
}
