'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [key, setKey] = useState('');

  // Accepts a full URL like https://site.com/p/ABC123 or just "ABC123"
  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = key.trim();
    if (!raw) return;

    let id = '';

    try {
      if (/^https?:\/\//i.test(raw)) {
        const u = new URL(raw);
        const m = u.pathname.match(/\/(p|solve|play|demo)\/([^/?#]+)/i);
        if (m) id = m[2];
      }
      if (!id) {
        id = raw.replace(/\s+/g, '');                // drop spaces
        id = id.replace(/[^A-Za-z0-9_-]/g, '');      // keep safe chars
      }
    } catch {
      /* ignore parse errors */
    }

    if (id) {
      router.push(`/p/${id}`); // 👉 if your route is /solve/[id], change to `/solve/${id}`
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          vishwa-crossword-maker
        </h1>
        <p className="mt-3 text-zinc-300">Make a crossword or open one from a link.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Create card */}
          <button
            onClick={() => router.push('/create')}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-left hover:bg-zinc-800 transition"
          >
            <h2 className="text-2xl font-semibold">Begin creating</h2>
            <p className="mt-2 text-zinc-400">Opens a blank creator room.</p>
            <div className="mt-4 inline-block rounded-md bg-white/10 px-4 py-2">
              Start a new crossword →
            </div>
          </button>

          {/* Open (was Solve) card */}
          <form onSubmit={handleOpen} className="rounded-lg border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">Open a puzzle link</h2>
            <p className="mt-2 text-zinc-400">Paste the share link or code someone sent you.</p>
            <div className="mt-4 flex gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Paste link or code"
                className="w-full rounded-md bg-black px-3 py-2 outline-none ring-1 ring-zinc-700 focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={!key.trim()}
                className="rounded-md px-4 py-2 bg-indigo-500 disabled:opacity-50 hover:bg-indigo-400 transition"
              >
                Open
              </button>
            </div>
          </form>

          {/* Works card */}
          <button
            onClick={() => router.push('/works')}
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-left hover:bg-zinc-800 transition md:col-span-2"
          >
            <h2 className="text-2xl font-semibold">Your works</h2>
            <p className="mt-2 text-zinc-400">Browse saved and published puzzles.</p>
            <div className="mt-4 inline-block rounded-md bg-white/10 px-4 py-2">
              Open works →
            </div>
          </button>
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-semibold">Works</h3>
          <p className="text-zinc-400 mt-1">
            Quick access to your crosswords. See <a href="/works" className="underline text-indigo-300">all works →</a>
          </p>
        </div>
      </div>
    </main>
  );
}
