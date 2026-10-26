import { Suspense } from 'react';
import { PushWatches } from '@/components/awareness/PushWatches';
export const metadata={title:'Browser push watches'};
export default function Page(){return <Suspense fallback={<p>Opening notification settings…</p>}><PushWatches/></Suspense>;}
