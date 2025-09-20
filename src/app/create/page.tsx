'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

type SymParam = 'r' | 'h' | 'v' | 'all' | 'none';

export default function CreateRoom() {
  const router = useRouter();
  const sp = useSearchParams();

  // Prefill from query if arriving "back" from Grid
  const initialSize = clamp(int(sp.get('size'), 15), 3, 21);
  const spSym = (sp.get('sym') ?? 'r').toLowerCase();
  const initialSym: SymParam = isSym(spSym) ? (spSym as SymParam) : 'r';

  // Use a string for the input so typing feels natural (no leading zeros)
  const [sizeStr, setSizeStr] = useState(String(initialSize));
  const [sym, setSym] = useState<SymParam>(initialSym);
  const max = 21, min = 3;

  const onSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // keep only digits; strip leading zeros (but allow empty while editing)
    let v = e.target.value.replace(/\D+/g, '');
    if (v.length > 1) v = v.replace(/^0+/, ''); // remove left zeros when multi-digit
    setSizeStr(v);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nRaw = sizeStr === '' ? initialSize : parseInt(sizeStr, 10);
    const n = clamp(nRaw, min, max);
    setSizeStr(String(n)); // normalize display
    router.push(`/create/grid?size=${n}&sym=${sym}`);
  };

  const SymButton = ({ value, label }: { value: SymParam; label: string }) => (
    <button
      type="button"
      onClick={() => setSym(value)}
      className={`rounded-md px-4 py-2 border ${
        sym === value
          ? 'bg-indigo-500 border-indigo-500'
          : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Create a crossword</h1>
        <p className="mt-2 text-zinc-400">Choose square size (max 21×21) and symmetry.</p>

        <form onSubmit={submit} className="mt-8 grid gap-6">
          <div className="max-w-sm">
            <label className="block">
              <span className="text-sm text-zinc-400">Size (N×N)</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={sizeStr}
                onChange={onSizeChange}
                placeholder="15"
                className="mt-1 w-full rounded-md bg-zinc-950 px-3 py-2 ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400 outline-none"
              />
              <p className="text-xs text-zinc-500 mt-1">Between {min} and {max}.</p>
            </label>
          </div>

          <div className="max-w-md">
            <span className="text-sm text-zinc-400">Symmetry (choose one)</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SymButton value="r"   label="Rotational (180°)" />
              <SymButton value="h"   label="Horizontal" />
              <SymButton value="v"   label="Vertical" />
              <SymButton value="all" label="All (H + V + 180°)" />
              <SymButton value="none" label="None" />
            </div>
          </div>

          <div>
            <button type="submit" className="rounded-md bg-indigo-500 hover:bg-indigo-400 px-6 py-2 font-medium">
              Create blank grid →
            </button>
          </div>

          <a href="/" className="text-sm text-indigo-300 underline">← Back to home</a>
        </form>
      </div>
    </main>
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
function isSym(v: string): v is 'r'|'h'|'v'|'all'|'none' {
  return ['r','h','v','all','none'].includes(v);
}
