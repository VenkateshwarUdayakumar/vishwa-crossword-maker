'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Entry = {
  num: number;
  kind: 'A' | 'D';
  start: number;
  row: number;
  col: number;
  len: number;
  cells: number[];
};

type ClueMap = Record<string, string>;
type RelMap = Record<string, string[]>;

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
};

export default function PromptsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const size = clamp(int(sp.get('size'), 15), 3, 21);
  const sym = (sp.get('sym') ?? 'r').toLowerCase();

  // Always decode the grid param and use decoded value everywhere
  const gridParamRaw = sp.get('grid') ?? '';
  const gridB64 = safeDecodeURIComponent(gridParamRaw);

  // ONE detector only
  const resetFromGrid = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem('grid-aesthetic');
      if (!raw) return false;
      const p = JSON.parse(raw) as { size: number; sym: string; reset?: boolean };
      return !!p && p.size === size && p.sym === sym && p.reset === true;
    } catch { return false; }
  })();

  // If we're resetting, nuke prior prompt data for this grid hash *before* state init.
  if (resetFromGrid) {
    try {
      const hash = hashBase64(gridB64);
      const fillsKey  = `fills-${size}-${sym}-${hash}`;
      const clueKey   = `clues-${size}-${sym}-${hash}`;
      const relKey    = `rel-${size}-${sym}-${hash}`;
      const titleKey  = `puz-title-${hashBase64(`${size}|${sym}|${gridB64}`)}`;

      localStorage.removeItem(fillsKey);
      localStorage.removeItem(clueKey);
      localStorage.removeItem(relKey);
      localStorage.removeItem(titleKey);
    } catch {}
  }

  /* ---------- blocks (URL first, then localStorage fallback) ---------- */
  const [blocks, setBlocks] = useState<boolean[]>(() => {
    const fromURL = decodeGrid(gridB64, size);
    return fromURL ?? Array(size * size).fill(false);
  });

  useEffect(() => {
    const fromURL = decodeGrid(gridB64, size);
    if (fromURL) { setBlocks(fromURL); return; }
    try {
      const saved = localStorage.getItem(`grid-${size}-${sym}`);
      const fromLocal = decodeGrid(saved ?? '', size);
      if (fromLocal) setBlocks(fromLocal);
    } catch {}
  }, [gridB64, size, sym]);

  // Keep a snapshot so the grid page also “remembers”
  useDebouncedEffect(() => {
    try { localStorage.setItem(`grid-${size}-${sym}`, gridB64); } catch {}
  }, 200, [gridB64, size, sym]);

  /* ---------- numbering (allows 1-letter entries) ---------- */
  const { numbers, across, down } = useMemo(() => numberGrid(blocks, size), [blocks, size]);

  // Lookup maps
  const cellToAcross: Record<number, Entry | undefined> = useMemo(() => {
    const m: Record<number, Entry> = {};
    for (const e of across) for (const i of e.cells) m[i] = e;
    return m;
  }, [across]);

  const cellToDown: Record<number, Entry | undefined> = useMemo(() => {
    const m: Record<number, Entry> = {};
    for (const e of down) for (const i of e.cells) m[i] = e;
    return m;
  }, [down]);

  const idToEntry: Record<string, Entry> = useMemo(() => {
    const m: Record<string, Entry> = {};
    for (const e of across) m[`A${e.num}`] = e;
    for (const e of down) m[`D${e.num}`] = e;
    return m;
  }, [across, down]);

  /* ---------- persistent state keys (decoded grid) ---------- */
  const hash = hashBase64(gridB64);
  const fillsKey  = `fills-${size}-${sym}-${hash}`;
  const clueKey   = `clues-${size}-${sym}-${hash}`;
  const relKey    = `rel-${size}-${sym}-${hash}`;
  const titleKey  = `puz-title-${hashBase64(`${size}|${sym}|${gridB64}`)}`;
  const greyKey   = `grey-${size}-${sym}-${hash}`;
  const bubbleKey = `bubble-${size}-${sym}-${hash}`;

  /* ---------- one-time migration from legacy (encoded) hash keys ---------- */
  useEffect(() => {
    if (resetFromGrid) return;
    const legacyHash = hashBase64(gridParamRaw);
    if (legacyHash === hash) return;
    const legacyF = `fills-${size}-${sym}-${legacyHash}`;
    const legacyC = `clues-${size}-${sym}-${legacyHash}`;
    const legacyR = `rel-${size}-${sym}-${legacyHash}`;
    const legacyT = `puz-title-${hashBase64(`${size}|${sym}|${gridParamRaw}`)}`;
    try {
      if (!localStorage.getItem(fillsKey) && localStorage.getItem(legacyF))
        localStorage.setItem(fillsKey, localStorage.getItem(legacyF)!);
      if (!localStorage.getItem(clueKey) && localStorage.getItem(legacyC))
        localStorage.setItem(clueKey, localStorage.getItem(legacyC)!);
      if (!localStorage.getItem(relKey) && localStorage.getItem(legacyR))
        localStorage.setItem(relKey, localStorage.getItem(legacyR)!);
      if (!localStorage.getItem(titleKey) && localStorage.getItem(legacyT))
        localStorage.setItem(titleKey, localStorage.getItem(legacyT)!);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- aesthetics: load/hydrate then persist ---------- */
  const [grey, setGrey] = useLocalJSON<boolean[]>(
    greyKey,
    () => Array(size * size).fill(false),
    (v) => isBoolArrayOfLen(v, size * size),
  );
  const [bubble, setBubble] = useLocalJSON<boolean[]>(
    bubbleKey,
    () => Array(size * size).fill(false),
    (v) => isBoolArrayOfLen(v, size * size),
  );

  // One-time migration from Grid page's aesthetic keys → hash-scoped keys
  useEffect(() => {
    try {
      const g = localStorage.getItem(`grid-grey-${size}-${sym}`);
      if (g && !localStorage.getItem(greyKey)) {
        const arr = decodeGrid(g, size);
        if (arr) {
          setGrey(arr);
          localStorage.setItem(greyKey, JSON.stringify(arr));
        }
      }
      const b = localStorage.getItem(`grid-bubble-${size}-${sym}`);
      if (b && !localStorage.getItem(bubbleKey)) {
        const arr = decodeGrid(b, size);
        if (arr) {
          setBubble(arr);
          localStorage.setItem(bubbleKey, JSON.stringify(arr));
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- handoff from Grid → Prompts (aesthetics) ----------
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('grid-aesthetic');
      if (!raw) return;
      const payload = JSON.parse(raw) as {
        size: number;
        sym: string;
        grey?: boolean[];
        bubble?: boolean[];
      };

      if (!payload || payload.size !== size || payload.sym !== sym) return;

      if (Array.isArray(payload.grey) && payload.grey.length === size * size) {
        setGrey(payload.grey);
        try { localStorage.setItem(greyKey, JSON.stringify(payload.grey)); } catch {}
      }
      if (Array.isArray(payload.bubble) && payload.bubble.length === size * size) {
        setBubble(payload.bubble);
        try { localStorage.setItem(bubbleKey, JSON.stringify(payload.bubble)); } catch {}
      }
    } catch {
      // ignore bad payloads
    } finally {
      try { sessionStorage.removeItem('grid-aesthetic'); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- fills / clues / relations (load then save, debounced) ---------- */
  const [fills, setFills] = useLocalJSON<string[]>(
    fillsKey,
    () => Array(size * size).fill(''),
    (v) => Array.isArray(v) && v.length === size * size,
  );
  const [clues, setClues] = useLocalJSON<ClueMap>(clueKey, () => ({}), isPlainObject);
  const [rel, setRel]     = useLocalJSON<RelMap>(relKey,   () => ({}), isPlainObject);

  // Related input draft visibility
  const [relDraft, setRelDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [k, arr] of Object.entries(rel)) next[k] = (arr ?? []).join(', ');
    setRelDraft(next);
  }, [rel]);

  const [relOpen, setRelOpen] = useState<Record<string, boolean>>({});
  const toggleRel = useCallback((id: string) => setRelOpen((prev) => ({ ...prev, [id]: !prev[id] })), []);

  /* ---------- puzzle title (load/save debounced) ---------- */
  const [title, setTitle] = useLocalString(titleKey, '');

  // If we arrived with the reset flag, force-blank in-memory state as well.
  useEffect(() => {
    if (!resetFromGrid) return;
    setFills(Array(size * size).fill(''));
    setClues({});
    setRel({});
    setTitle('');
    // clear reset bit so refresh doesn't keep wiping
    try {
      const raw = sessionStorage.getItem('grid-aesthetic');
      if (raw) {
        const p = JSON.parse(raw);
        sessionStorage.setItem('grid-aesthetic', JSON.stringify({ ...p, reset: false }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetFromGrid, size, sym, gridB64]);

  /* ---------- active cell + direction ---------- */
  const firstPlayable = useMemo(() => blocks.findIndex((b) => !b), [blocks]);
  const [activeCell, setActiveCell] = useState<number>(firstPlayable >= 0 ? firstPlayable : 0);
  const [activeDir, setActiveDir] = useState<'A' | 'D'>('A');

  useEffect(() => {
    if (firstPlayable >= 0) setActiveCell((prev) => (blocks[prev] ? firstPlayable : prev));
  }, [firstPlayable, blocks]);

  const activeEntry = useMemo(() => {
    if (blocks[activeCell]) return null;
    return activeDir === 'A' ? cellToAcross[activeCell] ?? null : cellToDown[activeCell] ?? null;
  }, [activeCell, activeDir, blocks, cellToAcross, cellToDown]);

  const activeCellsSet = useMemo(() => new Set(activeEntry?.cells ?? []), [activeEntry]);
  const activeId = useMemo(() => (activeEntry ? `${activeEntry.kind}${activeEntry.num}` : null), [activeEntry]);

  // forward-only related IDs (no reverse)
  const relatedIdsSet = useMemo(() => {
    const s = new Set<string>();
    if (!activeId) return s;
    for (const to of rel[activeId] ?? []) s.add(to);
    return s;
  }, [activeId, rel]);

  const relatedCellsSet = useMemo(() => {
    const s = new Set<number>();
    relatedIdsSet.forEach((id) => {
      const e = idToEntry[id];
      if (e) e.cells.forEach((i) => s.add(i));
    });
    return s;
  }, [relatedIdsSet, idToEntry]);

  /* ---------- navigation helpers ---------- */
  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusCell = useCallback((i: number, select = true) => {
    const el = cellRefs.current[i];
    if (el) { el.focus(); if (select) el.select?.(); }
  }, []);

  const setLetter = useCallback((cellIndex: number, ch: string) => {
    if (blocks[cellIndex]) return;
    ch = (ch.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
    setFills((prev) => {
      if (prev[cellIndex] === ch) return prev;
      const next = prev.slice();
      next[cellIndex] = ch;
      return next;
    });
  }, [blocks, setFills]);

  const moveWithinEntry = useCallback((dir: 'A' | 'D', delta: 1 | -1) => {
    const entry = dir === 'A' ? cellToAcross[activeCell] : cellToDown[activeCell];
    if (!entry) return;
    const idx = entry.cells.indexOf(activeCell);
    if (idx < 0) return;
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

    if (e.key === 'Tab') { setActiveDir((prev) => (prev === 'A' ? 'D' : 'A')); e.preventDefault(); return; }
    if (e.key === 'Enter') { moveToNextEntry(activeDir); e.preventDefault(); return; }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (activeDir !== 'A') { setActiveDir('A'); e.preventDefault(); return; }
      moveWithinEntry('A', e.key === 'ArrowRight' ? 1 : -1);
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (activeDir !== 'D') { setActiveDir('D'); e.preventDefault(); return; }
      moveWithinEntry('D', e.key === 'ArrowDown' ? 1 : -1);
      e.preventDefault(); return;
    }

    if (e.key === 'Backspace') {
      setLetter(i, '');
      moveWithinEntry(activeDir, -1);
      e.preventDefault();
      return;
    }
  }, [blocks, moveToNextEntry, activeDir, moveWithinEntry, setLetter]);

  const onGridChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, i: number) => {
    const ch = (e.target.value.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
    setLetter(i, ch);
    if (ch) moveWithinEntry(activeDir, 1);
  }, [activeDir, moveWithinEntry, setLetter]);

  /* ---------- completeness ---------- */
  const allCellFilled = useMemo(() => {
    for (let i = 0; i < size * size; i++) {
      if (!blocks[i] && !(fills[i] && /^[A-Z]$/.test(fills[i]))) return false;
    }
    return true;
  }, [blocks, fills, size]);

  const allCluesFilled = useMemo(() => {
    for (const e of across) {
      const id = `A${e.num}`;
      if (!clues[id] || !clues[id].trim()) return false;
    }
    for (const e of down) {
      const id = `D${e.num}`;
      if (!clues[id] || !clues[id].trim()) return false;
    }
    return true;
  }, [across, down, clues]);

  const isComplete = Boolean(title.trim()) && allCellFilled && allCluesFilled;

  /* ---------- save / review (Overwrite/Duplicate/Cancel) ---------- */
  const makeWork = useCallback((forcedTitle?: string): Work => ({
    id: `${hashBase64(`${(forcedTitle ?? title).trim() || 'Untitled'}|${Date.now()}`)}-${cryptoRand()}`,
    title: (forcedTitle ?? title).trim() || 'Untitled',
    size,
    sym,
    gridB64,
    blocks,
    fills,
    clues,
    rel,
    grey,
    bubble,
    updatedAt: Date.now(),
  }), [title, size, sym, gridB64, blocks, fills, clues, rel, grey, bubble]);

  const readList = (key: 'works-drafts' | 'works-completed'): Work[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]') as Work[]; } catch { return []; }
  };
  const writeList = (key: 'works-drafts' | 'works-completed', list: Work[]) => {
    localStorage.setItem(key, JSON.stringify(list));
  };

  const chooseDuplicateAction = useChooseDuplicateAction();

  const saveDraft = useCallback(() => {
    const list = readList('works-drafts');
    const t = title.trim() || 'Untitled';
    const choice = chooseDuplicateAction(list, t);
    if (choice.action === 'cancel') return;

    if (choice.action === 'overwrite') {
      const w = makeWork(choice.title);
      const ix = list.findIndex((x) => x.title === choice.title);
      list[ix] = { ...w, id: list[ix].id, updatedAt: Date.now() };
      writeList('works-drafts', list);
      alert('Draft overwritten.');
      return;
    }

    const w = makeWork(choice.title);
    list.push(w);
    writeList('works-drafts', list);
    alert('Draft saved.');
  }, [title, makeWork, chooseDuplicateAction]);

  const reviewWork = useCallback(() => {
    if (!isComplete) return;

    const completed = readList('works-completed');
    const drafts = readList('works-drafts');
    const t = title.trim() || 'Untitled';

    const choice = chooseDuplicateAction(completed, t);
    if (choice.action === 'cancel') return;

    let targetId = '';

    if (choice.action === 'overwrite') {
      const ix = completed.findIndex((x) => x.title === choice.title);
      const w = makeWork(choice.title);
      targetId = completed[ix].id;               // keep same id
      completed[ix] = { ...w, id: targetId, updatedAt: Date.now() };
    } else {
      const w = makeWork(choice.title);
      targetId = w.id;                            // new id
      completed.push(w);
    }

    if (choice.title === t) {
      const ixD = drafts.findIndex((w) => w.title === t);
      if (ixD >= 0) drafts.splice(ixD, 1);
    }

    writeList('works-completed', completed);
    writeList('works-drafts', drafts);

    router.push(`/demo/${targetId}`);
  }, [isComplete, title, makeWork, router, chooseDuplicateAction]);

  /* ---------- leave protection ---------- */
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  useEffect(() => { setDirty(true); }, [fills, clues, title, rel, grey, bubble]);

  const confirmNav = useCallback((href: string) => {
    if (!dirty || confirm('You may lose changes to your answers/clues. Leave this page?')) {
      router.push(href);
    }
  }, [dirty, router]);

  /* ---------- layout sizing ---------- */
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

  /* ---------- robust sessionStorage handoff (Works → Prompts) ---------- */
  useEffect(() => {
    if (resetFromGrid) return;
    let payloadRaw: string | null = null;
    try {
      payloadRaw = sessionStorage.getItem('work-open') ?? sessionStorage.getItem('__work-open-payload');
      if (!payloadRaw) return;
      const payload = JSON.parse(payloadRaw) as Partial<Work> & { size: number; sym: string; gridB64: string };
      if (!payload || payload.size !== size || payload.sym !== sym || payload.gridB64 !== gridB64) return;

      if (Array.isArray(payload.fills) && payload.fills.length === size * size) {
        setFills(payload.fills);
        try { localStorage.setItem(fillsKey, JSON.stringify(payload.fills)); } catch {}
      }
      if (payload.clues && Object.keys(payload.clues).length > 0) {
        setClues(payload.clues);
        try { localStorage.setItem(clueKey, JSON.stringify(payload.clues)); } catch {}
      }
      if (payload.rel && Object.keys(payload.rel).length > 0) {
        setRel(payload.rel);
        try { localStorage.setItem(relKey, JSON.stringify(payload.rel)); } catch {}
      }
      if (typeof payload.title === 'string' && payload.title.trim()) {
        setTitle(payload.title);
        try { localStorage.setItem(titleKey, payload.title); } catch {}
      }
      // aesthetics (optional)
      if (Array.isArray(payload.grey) && payload.grey.length === size * size) {
        setGrey(payload.grey);
        try { localStorage.setItem(greyKey, JSON.stringify(payload.grey)); } catch {}
      }
      if (Array.isArray(payload.bubble) && payload.bubble.length === size * size) {
        setBubble(payload.bubble);
        try { localStorage.setItem(bubbleKey, JSON.stringify(payload.bubble)); } catch {}
      }
    } catch {
      // ignore bad payloads
    } finally {
      try {
        sessionStorage.removeItem('work-open');
        sessionStorage.removeItem('__work-open-payload');
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- render ---------- */
  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      <div className="mx-auto h-full max-w-7xl px-6 py-4 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold">Prompts / Answers</h1>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Puzzle name (e.g., Friday Themeless #1)"
              className="w-[340px] max-w-[60vw] rounded-md bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <p className="text-zinc-400">
              Size: <span className="font-mono">{size}×{size}</span> · Sym:{' '}
              <span className="font-mono">{sym}</span>
            </p>
          </div>

          {/* Right: actions */}
          <div className="flex gap-2">
            <button
              onClick={() => confirmNav(`/create/grid?size=${size}&sym=${sym}&grid=${encodeURIComponent(gridB64)}`)}
              className="underline text-indigo-300"
            >
              ← Back to grid
            </button>
            <button onClick={() => confirmNav('/')} className="underline text-indigo-300">
              Home
            </button>

            <button
              onClick={saveDraft}
              className="rounded-md px-3 py-2 bg-amber-500 hover:bg-amber-400"
              title="Save as draft (allowed even if incomplete)"
            >
              Save draft
            </button>
            <button
              onClick={reviewWork}
              disabled={!isComplete}
              className={`rounded-md px-3 py-2 ${isComplete ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-emerald-500/40 cursor-not-allowed'}`}
              title={isComplete ? 'Open demo' : 'Fill all letters, clues, and title to enable'}
            >
              Demo crossword
            </button>
          </div>
        </div>

        {/* Content area */}
        <div ref={contentRef} className="mt-4 grid gap-8 md:grid-cols-[560px_1fr] min-h-0 flex-1">
          {/* Left: grid */}
          <div ref={gridWrapRef} className="w-full max-w-[560px]">
            <div
              ref={gridRef}
              className="grid gap-px bg-zinc-700"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxHeight: gridH ? `${gridH}px` : undefined }}
            >
              {Array.from({ length: size * size }).map((_, i) => {
                const isBlk = blocks[i];
                const isInActive = activeCellsSet.has(i);
                const isActiveCell = i === activeCell;
                const isRelated = relatedCellsSet.has(i);

                // Aesthetic layers (white-only)
                const isGrey = !isBlk && grey[i];
                const isBubble = !isBlk && bubble[i];

                let baseBg = 'bg-white';
                if (isBlk) baseBg = 'bg-zinc-900';
                else if (isInActive) baseBg = 'bg-blue-200';
                else if (isRelated) baseBg = 'bg-yellow-200';
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
                    {/* numbering */}
                    {!isBlk && numbers[i] > 0 && (
                      <span
                        className="absolute top-0 left-0 px-0.5 leading-none text-black/70 select-none"
                        style={{ fontSize: `${Math.max(9, Math.floor(cellPx * 0.3))}px` }}
                      >
                        {numbers[i]}
                      </span>
                    )}

                    {/* bubble ring overlay */}
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

                    {/* letter input */}
                    {!isBlk && (
                      <input
                        ref={(el) => { cellRefs.current[i] = el; }}
                        value={fills[i] ?? ''}
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

          {/* Right: prompts—two independent scroll panes matched to grid height */}
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
                    const isActive = isEntryActive(activeEntry, e);
                    const isRel = relatedIdsSet.has(id);
                    return (
                      <div
                        key={id}
                        onClick={() => { setActiveDir('A'); setActiveCell(e.start); focusCell(e.start); }}
                        className={[
                          'relative border rounded-md p-3 cursor-pointer',
                          isActive ? 'border-transparent bg-blue-500/15' :
                          isRel ? 'border-transparent bg-yellow-500/15' :
                          'border-zinc-700 bg-zinc-950/50',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); toggleRel(id); }}
                          className="absolute top-2 right-2 text-[11px] rounded px-1.5 py-0.5 bg-yellow-300/20 text-yellow-200 hover:bg-yellow-300/30 border border-yellow-300/20"
                          title="Add/View relations"
                        >
                          ⛓
                        </button>

                        <div className="text-sm text-zinc-400 mb-2">
                          <span className="font-semibold text-white mr-2">{e.num}.</span>
                          <span className="font-mono text-zinc-500">{e.len} letters</span>
                        </div>

                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${e.len}, minmax(0, 1fr))` }}>
                          {e.cells.map((cellIdx) => (
                            <input
                              key={cellIdx}
                              data-role="box"
                              value={fills[cellIdx] ?? ''}
                              onChange={(ev) => {
                                const ch = (ev.target.value.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
                                setLetter(cellIdx, ch);
                                setActiveDir('A');
                                setActiveCell(cellIdx);
                                if (ch) moveWithinEntry('A', 1);
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              maxLength={1}
                              inputMode="text"
                              autoCapitalize="characters"
                              className="text-sm text-center font-semibold uppercase rounded-md bg-zinc-950 ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                              placeholder="_"
                              style={{ fontSize: '0.875rem', width: '100%', height: '2.2em' }}
                            />
                          ))}
                        </div>

                        <input
                          value={clues[id] ?? ''}
                          onChange={(ev) => { setClues((prev) => ({ ...prev, [id]: ev.target.value })); }}
                          placeholder={`Clue for ${e.num} Across`}
                          className="mt-2 w-full rounded-md bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                          onClick={(ev) => ev.stopPropagation()}
                        />

                        {relOpen[id] && (
                          <input
                            value={relDraft[id] ?? ''}
                            onChange={(ev) => { const v = ev.target.value; setRelDraft((prev) => ({ ...prev, [id]: v })); }}
                            onBlur={(ev) => {
                              const list = parseRelList(ev.target.value);
                              setRel((prev) => ({ ...prev, [id]: list }));
                              setRelDraft((prev) => ({ ...prev, [id]: list.join(', ') }));
                            }}
                            placeholder="Related to (e.g., D3, A10)"
                            className="mt-2 w-full rounded-md bg-zinc-950 px-3 py-2 text-xs ring-1 ring-yellow-400/60 focus:ring-2 focus:ring-yellow-400 outline-none"
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
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
                    const isActive = isEntryActive(activeEntry, e);
                    const isRel = relatedIdsSet.has(id);
                    return (
                      <div
                        key={id}
                        onClick={() => { setActiveDir('D'); setActiveCell(e.start); focusCell(e.start); }}
                        className={[
                          'relative border rounded-md p-3 cursor-pointer',
                          isActive ? 'border-transparent bg-blue-500/15' :
                          isRel ? 'border-transparent bg-yellow-500/15' :
                          'border-zinc-700 bg-zinc-950/50',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); toggleRel(id); }}
                          className="absolute top-2 right-2 text-[11px] rounded px-1.5 py-0.5 bg-yellow-300/20 text-yellow-200 hover:bg-yellow-300/30 border border-yellow-300/20"
                          title="Add/View relations"
                        >
                          ⛓
                        </button>

                        <div className="text-sm text-zinc-400 mb-2">
                          <span className="font-semibold text-white mr-2">{e.num}.</span>
                          <span className="font-mono text-zinc-500">{e.len} letters</span>
                        </div>

                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${e.len}, minmax(0, 1fr))` }}>
                          {e.cells.map((cellIdx) => (
                            <input
                              key={cellIdx}
                              data-role="box"
                              value={fills[cellIdx] ?? ''}
                              onChange={(ev) => {
                                const ch = (ev.target.value.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
                                setLetter(cellIdx, ch);
                                setActiveDir('D');
                                setActiveCell(cellIdx);
                                if (ch) moveWithinEntry('D', 1);
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              maxLength={1}
                              inputMode="text"
                              autoCapitalize="characters"
                              className="text-sm text-center font-semibold uppercase rounded-md bg-zinc-950 ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                              placeholder="_"
                              style={{ fontSize: '0.875rem', width: '100%', height: '2.2em' }}
                            />
                          ))}
                        </div>

                        <input
                          value={clues[id] ?? ''}
                          onChange={(ev) => { setClues((prev) => ({ ...prev, [id]: ev.target.value })); }}
                          placeholder={`Clue for ${e.num} Down`}
                          className="mt-2 w-full rounded-md bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
                          onClick={(ev) => ev.stopPropagation()}
                        />

                        {relOpen[id] && (
                          <input
                            value={relDraft[id] ?? ''}
                            onChange={(ev) => { const v = ev.target.value; setRelDraft((prev) => ({ ...prev, [id]: v })); }}
                            onBlur={(ev) => {
                              const list = parseRelList(ev.target.value);
                              setRel((prev) => ({ ...prev, [id]: list }));
                              setRelDraft((prev) => ({ ...prev, [id]: list.join(', ') }));
                            }}
                            placeholder="Related to (e.g., A1, D7)"
                            className="mt-2 w-full rounded-md bg-zinc-950 px-3 py-2 text-xs ring-1 ring-yellow-400/60 focus:ring-2 focus:ring-yellow-400 outline-none"
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>

        <p className="text-zinc-500 text-sm mt-3">
          Click a cell and type; the entry highlights in blue. Press <span className="font-mono">Tab</span> to switch orientation, <span className="font-mono">Enter</span> to jump to the next entry. Use the ⛓ button to add one-way relations (related entries highlight yellow). Grey and Bubble styling carry over from the Grid page and are saved with the puzzle.
        </p>
      </div>
    </main>
  );
}

/* ---------- numbering & helpers ---------- */
function numberGrid(blocks: boolean[], n: number) {
  const N = n * n;
  const numbers = new Array<number>(N).fill(0);
  const across: Entry[] = [];
  const down: Entry[] = [];

  let num = 1;
  for (let i = 0; i < N; i++) {
    if (blocks[i]) continue;
    const r = (i / n) | 0; // row
    const c = i % n; // col

    const leftBlocked = c === 0 || blocks[i - 1];
    const aboveBlocked = r === 0 || blocks[i - n];

    if (leftBlocked) {
      const cells = collectRight(blocks, i, n);
      numbers[i] ||= num;
      across.push({ num: numbers[i], kind: 'A', start: i, row: r, col: c, len: cells.length, cells });
    }
    if (aboveBlocked) {
      numbers[i] ||= num;
      const cells = collectDown(blocks, i, n);
      down.push({ num: numbers[i], kind: 'D', start: i, row: r, col: c, len: cells.length, cells });
    }
    if (numbers[i]) num++;
  }

  return { numbers, across, down };
}

function collectRight(blocks: boolean[], i: number, n: number) {
  const cells: number[] = [i];
  for (let j = i + 1; j % n !== 0 && !blocks[j]; j++) cells.push(j);
  return cells;
}
function collectDown(blocks: boolean[], i: number, n: number) {
  const cells: number[] = [i];
  for (let j = i + n; j < n * n && !blocks[j]; j += n) cells.push(j);
  return cells;
}

function parseRelList(s: string): string[] {
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[AD]\d+$/.test(x));
}
function isEntryActive(active: Entry | null, e: Entry) {
  return !!active && active.kind === e.kind && active.start === e.start;
}

function int(v: string | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function safeDecodeURIComponent(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}
function decodeGrid(b64: string, size: number): boolean[] | null {
  if (!b64) return null;
  try {
    const bin = atob(b64);
    if (bin.length !== size * size) return null;
    return Array.from(bin, (ch) => ch === '1');
  } catch { return null; }
}
function hashBase64(b64: string) {
  let h = 0;
  for (let i = 0; i < b64.length; i++) h = (h * 31 + b64.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function cryptoRand() {
  return Math.floor(Math.random() * 1e9).toString(36);
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}
function isBoolArrayOfLen(v: unknown, len: number): v is boolean[] {
  return Array.isArray(v) && v.length === len && v.every((x) => typeof x === 'boolean');
}

/* ---------- tiny helpers ---------- */
function useRefOnceMap(keys: string[]) {
  const initial: Record<string, boolean> =
    Object.fromEntries(keys.map((k) => [k, false])) as Record<string, boolean>;
  const ref = useRef<Record<string, boolean>>(initial);
  return {
    get: (k: string) => ref.current[k],
    set: (k: string, v: boolean) => { ref.current[k] = v; },
  };
}

function useDebouncedEffect(effect: () => void, delay: number, deps: unknown[]) {
  useEffect(() => {
    const id = setTimeout(effect, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Persist and hydrate JSON-able state with debounce.
 */
function useLocalJSON<T>(key: string, init: () => T, validate?: (v: unknown) => boolean) {
  const did = useRefOnceMap(['loaded']);
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (!validate || validate(parsed)) return parsed as T;
      }
    } catch { /* ignore */ }
    return init();
  });

  useDebouncedEffect(() => {
    if (!did.get('loaded')) return; // avoid overwriting initial load
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, 150, [key, state]);

  useEffect(() => { did.set('loaded', true); }, [did]);

  return [state, setState] as const;
}

function useLocalString(key: string, initial = '') {
  const did = useRefOnceMap(['loaded']);
  const [val, setVal] = useState<string>(() => {
    try {
      const t = localStorage.getItem(key);
      return t !== null ? t : initial;
    } catch { return initial; }
  });
  useDebouncedEffect(() => {
    if (!did.get('loaded')) return;
    try { localStorage.setItem(key, val); } catch {}
  }, 150, [key, val]);
  useEffect(() => { did.set('loaded', true); }, [did]);
  return [val, setVal] as const;
}

/* ---------- duplicate-name chooser (stable) ---------- */
function nextNumberedTitle(existing: Work[], base: string): string {
  const t = base.trim() || 'Untitled';
  const rx = new RegExp(`^${escapeRegExp(t)}(?: \\((\\d+)\\))?$`, 'i');
  let max = 0;
  for (const w of existing) {
    const m = w.title.match(rx);
    if (m) max = Math.max(max, m[1] ? parseInt(m[1], 10) : 0);
  }
  const n = max + 1;
  return `${t} (${n})`;
}

function useChooseDuplicateAction() {
  return useCallback((existing: Work[], t: string) => {
    if (existing.find((w) => w.title === t) == null) {
      return { action: 'save', title: t, index: -1 } as const;
    }
    const input = window.prompt(
      `A work named "${t}" already exists.\n\nType one of:\n  O = Overwrite existing\n  D = Save as duplicate (e.g., "${t} (1)")\n  C = Cancel`,
      'D'
    );
    const ans = (input ?? '').trim().toUpperCase();
    if (ans === 'O') {
      return {
        action: 'overwrite',
        title: t,
        index: existing.findIndex((w) => w.title === t),
      } as const;
    }
    if (ans === 'D') {
      return {
        action: 'duplicate',
        title: nextNumberedTitle(existing, t),
        index: -1,
      } as const;
    }
    return { action: 'cancel', title: t, index: -1 } as const;
  }, []);
}
