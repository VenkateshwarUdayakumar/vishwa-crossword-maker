import { Suspense } from 'react';
import CreateRoomClient from './CreateRoomClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-400">Loading…</div>}>
      <CreateRoomClient />
    </Suspense>
  );
}
