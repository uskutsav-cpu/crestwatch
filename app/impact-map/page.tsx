import { Suspense } from 'react';
import { HistoricalMap } from '@/components/awareness/HistoricalMap';
export const metadata={title:'Flood extent map'};
export default function Page(){return <Suspense fallback={<p>Opening map…</p>}><HistoricalMap/></Suspense>;}
