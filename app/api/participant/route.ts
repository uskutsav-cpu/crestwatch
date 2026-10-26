import { proxyStudyRequest } from '@/lib/study-service-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>proxyStudyRequest(request);
export const POST=(request:Request)=>proxyStudyRequest(request);
export const DELETE=(request:Request)=>proxyStudyRequest(request);
