'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type SymParam = 'r' | 'h' | 'v' | 'all' | 'none';
type Flags = { r: boolean; h: boolean; v: boolean };
type Tool = 'white' | 'black' | 'grey' | 'bubble';

export default function GridPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const size = clamp(int(sp.get('size'), 15), 3, 21);
  const symParam = (sp.get('sym') ?? 'r').toLowerCase() as SymParam;
  const flags = paramToFlags(symParam);

  // --- Core blocks (functional cells) ---
  // ONLY restored from ?grid=... on forward navigation; otherwise blank.
  const [blocks, setBlocks] = useState<boolean[]>(() => {
    const fromURL = decodeGrid(sp.get('grid'), size);
    if (fromURL) return fromURL;
    return Array.from({ length: size * size }, () => false);
  });

  // --- Aesthetic layers (do not affect crossword logic) ---
  // These can be toggled on white cells and can coexist.
  const [grey, setGrey] = useState<boolean[]>(() => Array(size * size).fill(false));
  const [bubble, setBubble] = useState<boolean[]>(() => Array(size * size).fill(false));

 // Load aesthetics only when returning from Prompts (one-time)
useEffect(() => {
  try {
    // Clean up any old persisted aesthetics so they don't stick around
    localStorage.removeItem(`grid-grey-${size}-${symParam}`);
    localStorage.removeItem(`grid-bubble-${size}-${symParam}`);

    const raw = sessionStorage.getItem('grid-aesthetic');
    if (!raw) return;

    const parsed = JSON.parse(raw) as {
      size: number;
      sym: SymParam;
      grey: boolean[];
      bubble: boolean[];
      reset?: boolean;
    };

    if (
      parsed &&
      parsed.reset === true &&
      parsed.size === size &&
      parsed.sym === symParam &&
      Array.isArray(parsed.grey) &&
      Array.isArray(parsed.bubble) &&
      parsed.grey.length === size * size &&
      parsed.bubble.length === size * size
    ) {
      setGrey(parsed.grey);
      setBubble(parsed.bubble);

      // Flip reset so it won't re-apply on later visits
      sessionStorage.setItem(
        'grid-aesthetic',
        JSON.stringify({ ...parsed, reset: false })
      );
    }
  } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // run once


  const [dirty, setDirty] = useState(false);

  // Gate persisting to only when this page was reached via back/forward
const persistOnBackRef = useRef(false);
useEffect(() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    // Only allow persistence when the navigation type is back/forward
    persistOnBackRef.current = !!nav && nav.type === 'back_forward';
  } catch {
    persistOnBackRef.current = false;
  }
}, []);

// Persist snapshots ONLY if we arrived here via back/forward nav
useEffect(() => {
  if (!persistOnBackRef.current) return;
  try {
    localStorage.setItem(`grid-${size}-${symParam}`, encodeGrid(blocks));
    localStorage.setItem(`grid-grey-${size}-${symParam}`, encodeGrid(grey));
    localStorage.setItem(`grid-bubble-${size}-${symParam}`, encodeGrid(bubble));
  } catch {}
}, [blocks, grey, bubble, size, symParam]);


  // warn on tab close if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const cells = useMemo(() => Array.from({ length: size * size }), [size]);

  /* ---------------- Painting tools ---------------- */
  const [tool, setTool] = useState<Tool>('black');

  const toggleWithSymmetry = (idx: number) => {
    // For BLACK/WHITE, apply symmetry. For styles (GREY/BUBBLE), apply ONLY to the clicked cell.
    const symIndices = symmetricSet(idx, size, flags);

    if (tool === 'black') {
      // Paint black; strips aesthetics (symmetrically).
      setBlocks(prev => {
        const next = prev.slice();
        symIndices.forEach(i => (next[i] = true));
        return next;
      });
      setGrey(prev => {
        const next = prev.slice();
        symIndices.forEach(i => (next[i] = false));
        return next;
      });
      setBubble(prev => {
        const next = prev.slice();
        symIndices.forEach(i => (next[i] = false));
        return next;
      });
    } else if (tool === 'white') {
      // Paint white; keep aesthetics (symmetrically).
      setBlocks(prev => {
        const next = prev.slice();
        symIndices.forEach(i => (next[i] = false));
        return next;
      });
    } else if (tool === 'grey') {
      // Toggle grey ONLY on the clicked cell (no symmetry).
      setGrey(prev => {
        const next = prev.slice();
        if (!blocks[idx]) next[idx] = !next[idx];
        return next;
      });
    } else if (tool === 'bubble') {
      // Toggle bubble ONLY on the clicked cell (no symmetry).
      setBubble(prev => {
        const next = prev.slice();
        if (!blocks[idx]) next[idx] = !next[idx];
        return next;
      });
    }

    setDirty(true);
  };

  // go "back" to Create with current params
  const backToCreate = () => {
    if (!dirty || confirm('You may lose changes to this grid. Leave this page?')) {
      router.push(`/create?size=${size}&sym=${symParam}`);
    }
  };

  const goHome = () => {
    if (!dirty || confirm('You may lose changes to this grid. Leave this page?')) {
      router.push(`/`);
    }
  };

  const clearAllBlocks = () => {
    if (!dirty || confirm('Clear all blocks? This cannot be undone.')) {
      setBlocks(Array.from({ length: size * size }, () => false));
      setDirty(true);
    }
  };

  const clearAllStyles = () => {
    if (!dirty || confirm('Clear all grey/bubble styles?')) {
      setGrey(Array(size * size).fill(false));
      setBubble(Array(size * size).fill(false));
      setDirty(true);
    }
  };

  const nextToPrompts = () => {
  // Hand off aesthetics explicitly so Prompts can hydrate even after reloads.
  try {
    sessionStorage.setItem(
      'grid-aesthetic',
      JSON.stringify({
        size,
        sym: symParam,
        grey,
        bubble,
        reset: true,
      })
    );
  } catch {}

  const encoded = encodeGrid(blocks); // blocks still go in the URL
  router.push(`/create/prompts?size=${size}&sym=${symParam}&grid=${encoded}`);
};


  /* ---------------- Fit grid within the screen (no vertical scrollbar) ---------------- */
  // We compute a cell size that fits both width and available height.
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const [cellPx, setCellPx] = useState(28);

  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el) return;

    const recompute = () => {
      const gap = 1; // matches gap-px
      const wrapRect = el.getBoundingClientRect();
      const availW = Math.max(0, wrapRect.width);
      // available viewport height below top of the grid wrapper, minus some safe padding
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const availH = Math.max(0, viewportH - wrapRect.top - 120); // 120px padding for controls/footnote

      const cellFromW = Math.floor((availW - (size - 1) * gap) / size);
      const cellFromH = Math.floor((availH - (size - 1) * gap) / size);
      const next = clamp(Math.min(cellFromW, cellFromH), 12, 64); // sane bounds
      setCellPx(next);
    };

    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    window.addEventListener('resize', recompute);
    // Initial compute after mount
    setTimeout(recompute, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [size]);

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
    width: size * cellPx + (size - 1) * 1, // + gaps
    maxWidth: '100%',
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Block adder</h1>
            <p className="text-zinc-400 mt-1">
              Size: <span className="font-mono">{size}×{size}</span> · Symmetry:{' '}
              <span className="font-mono">{labelFlags(flags)}</span>
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Tool palette */}
            <div className="flex items-center gap-1 rounded-md border border-zinc-700 p-1 bg-zinc-900">
              <ToolButton active={tool==='black'} onClick={() => setTool('black')} label="Black"  hint="B"  />
              <ToolButton active={tool==='white'} onClick={() => setTool('white')} label="White"  hint="W"  />
              <div className="w-px h-6 bg-zinc-700 mx-1" />
              <ToolButton active={tool==='grey'}   onClick={() => setTool('grey')}   label="Grey"   hint="G"  />
              <ToolButton active={tool==='bubble'} onClick={() => setTool('bubble')} label="Bubble" hint="O"  />
            </div>

            <button onClick={backToCreate} className="underline text-indigo-300">
              ← Change settings
            </button>
            <button onClick={goHome} className="underline text-indigo-300">
              Home
            </button>
            <button onClick={clearAllBlocks} className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 hover:bg-zinc-800">
              Clear blocks
            </button>
            <button onClick={clearAllStyles} className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 hover:bg-zinc-800">
              Clear styles
            </button>
            <button onClick={nextToPrompts} className="rounded-md bg-indigo-500 px-4 py-2 hover:bg-indigo-400">
              Next: Prompts →
            </button>
          </div>
        </div>

        <div ref={gridWrapRef} className="mt-6">
          <div className="grid gap-px bg-zinc-700 mx-auto" style={gridStyle}>
            {cells.map((_, i) => {
              const isBlk = blocks[i];
              const isGrey = !isBlk && grey[i];
              const isBubble = !isBlk && bubble[i];
              const baseClass = isBlk ? 'bg-zinc-900' : (isGrey ? 'bg-zinc-200' : 'bg-white');
              return (
                <div
                  key={i}
                  className={`${baseClass} relative transition hover:ring-2 hover:ring-indigo-400`}
                  style={{ width: `${cellPx}px`, height: `${cellPx}px` }}
                  aria-label={`cell-${i}`}
                  onClick={() => toggleWithSymmetry(i)}
                >
                  {/* Bubble ring (aesthetic only) */}
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
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-zinc-500 text-sm mt-4">
          Rotational is 180° only. “All” applies Horizontal + Vertical + 180°. Grey and Bubble are visual-only and apply to white cells.
        </p>
      </div>
    </main>
  );
}

function ToolButton({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-sm ${active ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'} border border-zinc-700`}
      title={hint ? `${label} (${hint})` : label}
    >
      {label}{hint ? <span className="opacity-60 ml-1">[{hint}]</span> : null}
    </button>
  );
}

/* helpers */
function int(v: string | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function rcFromIndex(i: number, n: number) {
  return { r: Math.floor(i / n), c: i % n };
}
function idxFromRC(r: number, c: number, n: number) {
  return r * n + c;
}
function paramToFlags(p: SymParam): Flags {
  if (p === 'none') return { r: false, h: false, v: false };
  if (p === 'all')  return { r: true,  h: true,  v: true  };
  return { r: p === 'r', h: p === 'h', v: p === 'v' };
}
function symmetricSet(i: number, n: number, f: Flags): number[] {
  const { r, h, v } = f;
  const { r: row, c: col } = rcFromIndex(i, n);
  const rr = n - 1 - row;
  const cc = n - 1 - col;
  const s = new Set<number>();
  s.add(i);
  if (h) s.add(idxFromRC(rr, col, n));   // horizontal mirror
  if (v) s.add(idxFromRC(row, cc, n));   // vertical mirror
  if (r) s.add(idxFromRC(rr, cc, n));    // 180° rotation
  return Array.from(s);
}
function labelFlags(f: Flags) {
  const parts: string[] = [];
  if (f.r) parts.push('Rotational(180°)');
  if (f.h) parts.push('Horizontal');
  if (f.v) parts.push('Vertical');
  return parts.length ? parts.join(' + ') : 'None';
}
function encodeGrid(bits: boolean[]) {
  const bin = bits.map(b => (b ? '1' : '0')).join('');
  return typeof window !== 'undefined' ? btoa(bin) : '';
}
function decodeGrid(b64: string | null, size: number): boolean[] | null {
  if (!b64) return null;
  try {
    const bin = atob(b64);
    if (bin.length !== size * size) return null;
    return Array.from(bin, ch => ch === '1');
  } catch { return null; }
}
