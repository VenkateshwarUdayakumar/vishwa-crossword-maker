import { Suspense } from 'react';
import PromptsClient from './PromptsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-400">Loading…</div>}>
      <PromptsClient />
    </Suspense>
  );
}