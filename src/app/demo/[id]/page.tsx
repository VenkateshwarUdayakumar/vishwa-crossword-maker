'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ================== types ================== */
type ClueMap = Record<string, string>;
type RelMap  = Record<string, string[]>;
type Work = {
  id: string;
  title: string;
  size: number;
  sym: string;
  gridB64: string;          // '1' block, '0' white, base64-encoded
  blocks: boolean[];
  fills: string[];
  clues: ClueMap;
  rel: RelMap;
  grey?: boolean[];
  bubble?: boolean[];
  updatedAt: number;
};

/* ================== constants (works buckets) ================== */
const PUBLISHED_KEY = 'works-published' as const; // [{ code, title, rows, cols, createdAt }]
const DRAFTS_KEY = 'works-drafts' as const;
const SAVED_KEY  = 'works-completed' as const;

type PublishedMeta = { code: string; title: string; rows: number; cols: number; createdAt?: number };

function __readDrafts(): Work[] {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as Work[]; } catch { return []; }
}
function __writeDrafts(list: Work[]) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(list)); } catch {}
}
function __readSaved(): Work[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as Work[]; } catch { return []; }
}
function __writeSaved(list: Work[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch {}
}
function __readPublished(): PublishedMeta[] {
  try { return JSON.parse(localStorage.getItem(PUBLISHED_KEY) ?? '[]') as PublishedMeta[]; } catch { return []; }
}
function __writePublished(list: PublishedMeta[]) {
  try { localStorage.setItem(PUBLISHED_KEY, JSON.stringify(list)); } catch {}
}
function __allTitles(): Set<string> {
  const s = new Set<string>();
  for (const w of __readDrafts()) s.add((w.title ?? '').trim());
  for (const w of __readSaved())  s.add((w.title ?? '').trim());
  for (const p of __readPublished()) s.add((p.title ?? '').trim());
  s.delete('');
  return s;
}
function __removeTitleEverywhere(title: string) {
  const t = title.trim();
  if (!t) return;
  const d = __readDrafts().filter(w => (w.title ?? '').trim() !== t);
  const s = __readSaved().filter(w  => (w.title ?? '').trim() !== t);
  const p = __readPublished().filter(pm => (pm.title ?? '').trim() !== t);
  __writeDrafts(d);
  __writeSaved(s);
  __writePublished(p);
}
function nextNumberedTitleAcross(base: string): string {
  const t = (base.trim() || 'Untitled');
  const titles = __allTitles();
  if (!titles.has(t)) return t;
  let n = 1;
  while (titles.has(`${t} (${n})`)) n++;
  return `${t} (${n})`;
}

/* ================== helpers ================== */
type Entry = {
  num: number;
  kind: 'A' | 'D';
  start: number;
  row: number;
  col: number;
  len: number;
  cells: number[];
};

function decodeGrid(b64: string, size: number): boolean[] {
  if (!b64) return Array(size * size).fill(false);
  try {
    const bin = atob(b64);
    if (bin.length !== size * size) return Array(size * size).fill(false);
    return Array.from(bin, (ch) => ch === '1');
  } catch {
    return Array(size * size).fill(false);
  }
}

function numberGrid(blocks: boolean[], n: number) {
  const N = n * n;
  const numbers = new Array<number>(N).fill(0);
  const across: Entry[] = [];
  const down: Entry[] = [];

  let num = 1;
  for (let i = 0; i < N; i++) {
    if (blocks[i]) continue;
    const r = (i / n) | 0;
    const c = i % n;
    const leftBlocked  = c === 0 || blocks[i - 1];
    const aboveBlocked = r === 0 || blocks[i - n];

    if (leftBlocked) {
      const cells: number[] = [i];
      for (let j = i + 1; j % n !== 0 && !blocks[j]; j++) cells.push(j);
      numbers[i] ||= num;
      across.push({ num: numbers[i], kind: 'A', start: i, row: r, col: c, len: cells.length, cells });
    }
    if (aboveBlocked) {
      numbers[i] ||= num;
      const cells: number[] = [i];
      for (let j = i + n; j < N && !blocks[j]; j += n) cells.push(j);
      down.push({ num: numbers[i], kind: 'D', start: i, row: r, col: c, len: cells.length, cells });
    }
    if (numbers[i]) num++;
  }

  return { numbers, across, down };
}

function fmtTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function hashBase64(b64: string) {
  let h = 0;
  for (let i = 0; i < b64.length; i++) h = (h * 31 + b64.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
function genCode(gridB64: string) {
  // short, mixed: hash + random
  const h = hashBase64(gridB64).slice(0, 4).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return (h + r).slice(0, 6); // 6 chars
}

/* ================== page ================== */
export default function DemoPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  /* -------- load the saved Work by id -------- */
  const [work, setWork] = useState<Work | null>(null);
  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem('works-saved') ?? localStorage.getItem('works-completed') ?? '[]';
      const list = JSON.parse(raw) as Work[];
      setWork(list.find((w) => w.id === id) ?? null);
    } catch {
      setWork(null);
    }
  }, [id]);

  /* -------- derived basics (keep hooks unconditional) -------- */
  const size    = work?.size ?? 0;
  const sym     = work?.sym ?? 'r';
  const title   = work?.title ?? '';
  const gridB64 = work?.gridB64 ?? '';

  const grey   = useMemo(
    () => (work?.grey && work.grey.length === size * size ? work.grey : Array(size * size).fill(false)),
    [work, size]
  );
  const bubble = useMemo(
    () => (work?.bubble && work.bubble.length === size * size ? work.bubble : Array(size * size).fill(false)),
    [work, size]
  );

  const blocks = useMemo(() => (size ? decodeGrid(gridB64, size) : []), [gridB64, size]);
  const { numbers, across, down } = useMemo(() => numberGrid(blocks, size || 1), [blocks, size]);

  /* -------- solver fills (fresh on open, persist during session) -------- */
  const [pfills, setPfills] = useState<string[]>([]);
  const didFreshen = useRef(false);
  useEffect(() => {
    if (!id || !size || didFreshen.current) return;
    const empty = Array(size * size).fill('');
    try { localStorage.removeItem(`play-demo-fills-${id}`); } catch {}
    setPfills(empty);
    didFreshen.current = true;
  }, [id, size]);

  useEffect(() => {
    if (!id || !size || !didFreshen.current) return;
    try { localStorage.setItem(`play-demo-fills-${id}`, JSON.stringify(pfills)); } catch {}
  }, [id, size, pfills]);

  /* -------- active entry / nav -------- */
  const firstPlayable = useMemo(() => blocks.findIndex((b) => !b), [blocks]);
  const [activeCell, setActiveCell] = useState<number>(firstPlayable >= 0 ? firstPlayable : 0);
  const [activeDir, setActiveDir] = useState<'A' | 'D'>('A');
  useEffect(() => {
    if (firstPlayable >= 0) setActiveCell((prev) => (blocks[prev] ? firstPlayable : prev));
  }, [firstPlayable, blocks]);

  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusCell = useCallback((i: number, select = true) => {
    const el = cellRefs.current[i];
    if (el) { el.focus(); if (select) el.select?.(); }
  }, []);

  const cellToAcross: Record<number, Entry | undefined> = useMemo(() => {
    const m: Record<number, Entry> = {};
    for (const e of across) e.cells.forEach((i) => (m[i] = e));
    return m;
  }, [across]);
  const cellToDown: Record<number, Entry | undefined> = useMemo(() => {
    const m: Record<number, Entry> = {};
    for (const e of down) e.cells.forEach((i) => (m[i] = e));
    return m;
  }, [down]);

  const activeEntry = useMemo(() => {
    if (blocks[activeCell]) return null;
    return activeDir === 'A' ? cellToAcross[activeCell] ?? null : cellToDown[activeCell] ?? null;
  }, [activeCell, activeDir, blocks, cellToAcross, cellToDown]);
  const activeCellsSet = useMemo(() => new Set(activeEntry?.cells ?? []), [activeEntry]);

  const setLetter = useCallback((i: number, ch: string) => {
    if (blocks[i]) return;
    const c = (ch.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
    setPfills((prev) => {
      if (prev[i] === c) return prev;
      const next = prev.slice();
      next[i] = c;
      return next;
    });
  }, [blocks]);

  const moveWithinEntry = useCallback((dir: 'A' | 'D', delta: 1 | -1) => {
    const map = dir === 'A' ? cellToAcross : cellToDown;
    const entry = map[activeCell];
    if (!entry) return;
    const idx = entry.cells.indexOf(activeCell);
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= entry.cells.length) return;
    const nextCell = entry.cells[nextIdx];
    setActiveCell(nextCell);
    setActiveDir(dir);
    focusCell(nextCell, true);
  }, [activeCell, cellToAcross, cellToDown, focusCell]);

  const moveToNextEntry = useCallback((dir: 'A' | 'D') => {
    const list = dir === 'A' ? across : down;
    if (list.length === 0) return;
    const startNum = activeEntry?.num ?? list[0].num;
    let idx = list.findIndex((e) => e.num === startNum);
    if (idx < 0) idx = 0;
    const next = list[(idx + 1) % list.length];
    setActiveDir(dir);
    setActiveCell(next.start);
    focusCell(next.start, true);
  }, [across, down, activeEntry, focusCell]);

  const onGridCellClick = useCallback((i: number) => {
    if (blocks[i]) return;
    const hasAcross = !!cellToAcross[i];
    const hasDown = !!cellToDown[i];
    if (i === activeCell && hasAcross && hasDown) {
      setActiveDir((prev) => (prev === 'A' ? 'D' : 'A'));
      focusCell(i, true);
      return;
    }
    let newDir = activeDir;
    if (newDir === 'A' && !hasAcross && hasDown) newDir = 'D';
    if (newDir === 'D' && !hasDown && hasAcross) newDir = 'A';
    setActiveCell(i);
    setActiveDir(newDir);
    focusCell(i, true);
  }, [blocks, cellToAcross, cellToDown, activeCell, activeDir, focusCell]);

  const onGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (blocks[i]) return;

    if (e.key === 'Tab')   { setActiveDir((p) => (p === 'A' ? 'D' : 'A')); e.preventDefault(); return; }
    if (e.key === 'Enter') { moveToNextEntry(activeDir); e.preventDefault(); return; }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (activeDir !== 'A') { setActiveDir('A'); e.preventDefault(); return; }
      moveWithinEntry('A', e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (activeDir !== 'D') { setActiveDir('D'); e.preventDefault(); return; }
      moveWithinEntry('D', e.key === 'ArrowDown' ? 1 : -1); e.preventDefault(); return;
    }

    if (e.key === 'Backspace') {
      setLetter(i, '');
      moveWithinEntry(activeDir, -1);
      e.preventDefault();
    }
  }, [blocks, moveToNextEntry, activeDir, moveWithinEntry, setLetter]);

  const onGridChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const ch = (e.target.value.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
    setLetter(i, ch);
    if (ch) moveWithinEntry(activeDir, 1);
  }, [activeDir, moveWithinEntry, setLetter]);

  /* -------- TIMER (starts on first input, stops on solve) -------- */
  const [elapsedBase, setElapsedBase] = useState(0);
  const [running, setRunning] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    setElapsedBase(0);
    setRunning(false);
    startRef.current = null;
    setDisplayMs(0);
  }, [id]);

  const isReady = useMemo(
    () => size > 0 && blocks.length === size * size && pfills.length === size * size,
    [size, blocks, pfills]
  );

  const hasAnyInput = useMemo(
    () => isReady && pfills.some((ch, i) => !blocks[i] && /^[A-Z]$/.test(ch ?? '')),
    [isReady, pfills, blocks]
  );

  const isSolved = useMemo(
    () => isReady && pfills.every((ch, i) => blocks[i] || /^[A-Z]$/.test(ch ?? '')),
    [isReady, pfills, blocks]
  );

  useEffect(() => {
    if (!isReady) return;
    if (isSolved) {
      const last = startRef.current;
      const now = Date.now();
      if (running && typeof last === 'number' && last > 0 && now >= last) {
        setElapsedBase((prev) => prev + (now - last));
      }
      setRunning(false);
      startRef.current = null;
      return;
    }
    if (!running && startRef.current == null && hasAnyInput) {
      startRef.current = Date.now();
      setRunning(true);
    }
  }, [isReady, isSolved, hasAnyInput, running]);

  useEffect(() => {
    const update = () => {
      if (!running) { setDisplayMs(elapsedBase); return; }
      const last = startRef.current;
      const now = Date.now();
      const delta = (typeof last === 'number' && last > 0 && now >= last) ? (now - last) : 0;
      setDisplayMs(elapsedBase + delta);
    };
    update();
    if (!running) return;
    const t = setInterval(update, 250);
    return () => clearInterval(t);
  }, [running, elapsedBase]);

  const onResetAll = () => {
    const empty = Array(size * size).fill('');
    setPfills(empty);
    setElapsedBase(0);
    setRunning(false);
    startRef.current = null;
    setDisplayMs(0);
  };

  /* -------- PUBLISH -------- */
  const [justPublishedCode, setJustPublishedCode] = useState<string | null>(null);

 const publish = useCallback(async () => {
  if (!work) return;

  // Prompt if this title already exists in Drafts/Saved/Published
  const t0 = (work.title || 'Untitled').trim();
  const titles = __allTitles();
  let finalTitle = t0;

  if (titles.has(t0)) {
    const input = window.prompt(
      `An item named "${t0}" already exists (in Drafts/Saved/Published).\n\nType one of:\n  O = Overwrite (replace existing title across sections)\n  D = Save as duplicate (e.g., "${t0} (1)")\n  C = Cancel`,
      'D'
    );
    const ans = (input ?? '').trim().toUpperCase();
    if (ans === 'C' || ans === '') return;
    if (ans === 'O') {
      __removeTitleEverywhere(t0);
      finalTitle = t0;
    } else {
      finalTitle = nextNumberedTitleAcross(t0);
    }
  }

  const payload = {
    title: finalTitle,
    rows: work.size,
    cols: work.size,
    grid_b64: work.gridB64,
    clues: work.clues ?? {},
    rel: work.rel ?? {},
    sym: work.sym ?? 'r',
    grey: Array.isArray(work.grey) ? work.grey : undefined,
    bubble: Array.isArray(work.bubble) ? work.bubble : undefined,
  };

  try {
    const res = await fetch(`/api/puzzles/${genCode(work.gridB64)}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
        const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Publish failed:', res.status, json);
      throw new Error(json?.error ?? 'Failed');
    }
    if (json?.warn) {
      console.warn('Publish returned warning:', json.warn);
    }


    const code = json.code as string;

    // Append meta to Published list (unique title already enforced)
    const list = __readPublished();
    list.push({ code, title: payload.title, rows: payload.rows, cols: payload.cols, createdAt: Date.now() });
    __writePublished(list);

    setJustPublishedCode(code);
    try { await navigator.clipboard.writeText(code); } catch {}
  } catch (e) {
    alert('Failed to publish to server.');
    console.error(e);
  }
}, [work]);


  /* -------- layout sizing (match Prompts), no cellPx kept -------- */
  /* -------- layout sizing (match Prompts) -------- */
const gridWrapRef = useRef<HTMLDivElement | null>(null);
const gridRef = useRef<HTMLDivElement | null>(null);
const contentRef = useRef<HTMLDivElement | null>(null);
const [cellPx, setCellPx] = useState(28);
const [gridH, setGridH] = useState(0);


  useEffect(() => {
  if (!gridRef.current || !gridWrapRef.current) return;
  const wrap = gridWrapRef.current;
  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    const gap = 1;
    const cell = Math.max(12, Math.floor((w - (size - 1) * gap) / size));
    setCellPx(cell);
    const contentH = contentRef.current?.clientHeight ?? w;
    setGridH(Math.floor(Math.min(w, contentH)));
  });
  ro.observe(wrap);
  return () => ro.disconnect();
}, [size]);


  /* -------- render -------- */
  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      <div className="mx-auto h-full max-w-7xl px-6 py-4 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold">{title || 'Demo puzzle'}</h1>
            <p className="text-zinc-400">
              Size: <span className="font-mono">{size}×{size}</span> · Sym:{' '}
              <span className="font-mono">{sym}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={[
                'rounded-md px-3 py-1.5 font-mono text-sm',
                isSolved ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-100'
              ].join(' ')}
              title={isSolved ? 'Solved!' : hasAnyInput ? 'Solving…' : 'Start typing to begin the timer'}
            >
              ⏱ {fmtTime(displayMs)}
            </div>

            {/* Publish */}
            <button
              onClick={publish}
              disabled={!work}
              className="rounded-md px-3 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50"
              title="Publish and get a code"
            >
              Publish
            </button>

            <button
              onClick={onResetAll}
              className="rounded-md px-3 py-2 bg-zinc-700 hover:bg-zinc-600"
            >
              Reset
            </button>

            <Link href="/works" className="underline text-indigo-300 px-3 py-2">
              Back to works
            </Link>
          </div>
        </div>

        {/* Show code after publish */}
        {justPublishedCode && (
          <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 p-3 flex items-center justify-between">
            <div className="text-sm">
              Published code:&nbsp;
              <span className="font-mono text-white px-1.5 py-0.5 rounded bg-zinc-800">
                {justPublishedCode}
              </span>
              <span className="text-zinc-400 ml-2">
                Share this on the home page “Open a puzzle link”.
              </span>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
                onClick={() => navigator.clipboard.writeText(justPublishedCode!).catch(() => {})}
              >
                Copy code
              </button>
              <Link
                className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
                href={`/p/${justPublishedCode}`}
              >
                Open link
              </Link>
            </div>
          </div>
        )}

        {!work ? (
          <div className="mt-6 text-zinc-400">Not found in your Saved list.</div>
        ) : (
          <>
            {/* Content area */}
            <div ref={contentRef} className="mt-4 grid gap-8 md:grid-cols-[560px_1fr] min-h-0 flex-1">
              {/* Left: grid */}
              <div ref={gridWrapRef} className="w-full max-w-[560px]">
                <div
                  ref={gridRef}
                  className="grid gap-px bg-zinc-700"
                  style={{ gridTemplateColumns: `repeat(${size || 1}, minmax(0, 1fr))`, maxHeight: gridH ? `${gridH}px` : undefined }}
                >
                  {Array.from({ length: size * size }).map((_, i) => {
                    const isBlk = blocks[i];
                    const isInActive = activeCellsSet.has(i);
                    const isActiveCell = i === activeCell;

                    const isGrey = !isBlk && grey[i];
                    const isBubble = !isBlk && bubble[i];

                    let baseBg = 'bg-white';
                    if (isBlk) baseBg = 'bg-zinc-900';
                    else if (isInActive) baseBg = 'bg-blue-200';
                    else if (isGrey) baseBg = 'bg-zinc-400';

                    return (
                      <div
                        key={i}
                        className={[
                          'relative aspect-square',
                          baseBg,
                          !isBlk && isActiveCell ? 'outline outline-2 outline-sky-400' : '',
                        ].join(' ')}
                        onClick={() => onGridCellClick(i)}
                      >
                        {!isBlk && numbers[i] > 0 && (
                          <span
                            className="absolute top-0 left-0 px-0.5 leading-none text-black/70 select-none"
                            style={{ fontSize: `${Math.max(9, Math.floor(cellPx * 0.3))}px` }}
                          >
                            {numbers[i]}
                          </span>
                        )}

                        {isBubble && (
                          <span
                            className="absolute inset-0 m-auto rounded-full border-2 border-zinc-900 pointer-events-none"
                            style={{
                              width: `${Math.floor(cellPx * 0.7)}px`,
height: `${Math.floor(cellPx * 0.7)}px`,

                              top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        )}

                        {!isBlk && (
                          <input
                            ref={(el) => { cellRefs.current[i] = el; }}
                            value={pfills[i] ?? ''}
                            onChange={(e) => onGridChange(e, i)}
                            onKeyDown={(e) => onGridKeyDown(e, i)}
                            maxLength={1}
                            inputMode="text"
                            autoCapitalize="characters"
                            aria-label={`grid-cell-${i}`}
                            className="absolute inset-0 w-full h-full text-center font-semibold uppercase outline-none bg-transparent"
                            style={{ fontSize: `${Math.max(12, Math.floor(cellPx * 0.62))}px`, color: '#000' }}

                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: clues (read-only), two columns like Prompts */}
              <div className="grid md:grid-cols-2 gap-8 items-start min-h-0">
                {/* Across */}
                <section className="min-h-0 overflow-y-auto pr-2" style={{ maxHeight: gridH ? `${gridH}px` : undefined }}>
                  <h2 className="text-lg font-semibold sticky top-0 bg-black/80 backdrop-blur z-10 py-1">Across</h2>
                  <div className="mt-3 grid gap-4">
                    {across.length === 0 ? (
                      <p className="text-zinc-400 text-sm">No across entries.</p>
                    ) : (
                      across.map((e) => {
                        const id = `A${e.num}`;
                        const clue = work.clues[id] ?? '';
                        const isActive = !!activeEntry && activeEntry.kind === e.kind && activeEntry.start === e.start;
                        return (
                          <div
                            key={id}
                            onClick={() => { setActiveDir('A'); setActiveCell(e.start); focusCell(e.start); }}
                            className={[
                              'relative border rounded-md p-3 cursor-pointer',
                              isActive ? 'border-transparent bg-blue-500/15' : 'border-zinc-700 bg-zinc-950/50',
                            ].join(' ')}
                          >
                            <div className="text-sm text-zinc-400 mb-1">
                              <span className="font-semibold text-white mr-2">{e.num}.</span>
                              <span className="font-mono text-zinc-500">{e.len} letters</span>
                            </div>
                            <div className="text-sm">{clue || <span className="text-zinc-500 italic">No clue.</span>}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Down */}
                <section className="min-h-0 overflow-y-auto pr-2" style={{ maxHeight: gridH ? `${gridH}px` : undefined }}>
                  <h2 className="text-lg font-semibold sticky top-0 bg-black/80 backdrop-blur z-10 py-1">Down</h2>
                  <div className="mt-3 grid gap-4">
                    {down.length === 0 ? (
                      <p className="text-zinc-400 text-sm">No down entries.</p>
                    ) : (
                      down.map((e) => {
                        const id = `D${e.num}`;
                        const clue = work.clues[id] ?? '';
                        const isActive = !!activeEntry && activeEntry.kind === e.kind && activeEntry.start === e.start;
                        return (
                          <div
                            key={id}
                            onClick={() => { setActiveDir('D'); setActiveCell(e.start); focusCell(e.start); }}
                            className={[
                              'relative border rounded-md p-3 cursor-pointer',
                              isActive ? 'border-transparent bg-blue-500/15' : 'border-zinc-700 bg-zinc-950/50',
                            ].join(' ')}
                          >
                            <div className="text-sm text-zinc-400 mb-1">
                              <span className="font-semibold text-white mr-2">{e.num}.</span>
                              <span className="font-mono text-zinc-500">{e.len} letters</span>
                            </div>
                            <div className="text-sm">{clue || <span className="text-zinc-500 italic">No clue.</span>}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </div>

            <p className="text-zinc-500 text-sm mt-3">
              Your timer starts when you type your first letter and stops when every non-block cell is filled. Publish to get a code that friends can enter on the home page.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
