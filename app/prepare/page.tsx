import { Suspense } from 'react';
import { Preparedness } from '@/components/awareness/Preparedness';
export const metadata={title:'Flood preparedness checklist'};
export default function Page(){return <Suspense fallback={<p>Opening checklist…</p>}><Preparedness/></Suspense>;}
