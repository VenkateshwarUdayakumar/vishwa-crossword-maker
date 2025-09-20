import { Suspense } from 'react';
import GridClient from './GridClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-400">Loading grid…</div>}>
      <GridClient />
    </Suspense>
  );
}
