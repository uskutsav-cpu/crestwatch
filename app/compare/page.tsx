import { Suspense } from 'react';
import { GaugeCompare } from '@/components/awareness/GaugeCompare';
export const metadata={title:'Compare past floods'};
export default function Page(){return <Suspense fallback={<p>Opening comparison…</p>}><GaugeCompare/></Suspense>;}
