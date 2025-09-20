'use client';

import Link from 'next/link';

type Props = { params: { key: string } };

export default function SolveRoom({ params }: Props) {
  const { key } = params;
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Solving Room</h1>
        <p className="mt-2 text-zinc-400">
          Joined with key: <span className="font-mono text-white">{key}</span>
        </p>
        <p className="mt-2 text-zinc-400">Placeholder — solver UI coming soon.</p>

        <Link href="/" className="mt-6 inline-block underline text-indigo-300">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
