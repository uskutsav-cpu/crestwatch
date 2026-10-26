import { VAPID_PUBLIC_KEY } from '@/lib/push-config';
import { proxyPushRequest } from '@/lib/push-service-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=()=>Response.json({ok:true,publicKey:VAPID_PUBLIC_KEY},{headers:{'Cache-Control':'no-store'}});
export const POST=(request:Request)=>proxyPushRequest(request);
