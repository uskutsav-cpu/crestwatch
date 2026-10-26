import {describe,it,expect,vi} from 'vitest';
import {proxyStudyRequest,studyCookieOnly} from '@/lib/study-service-proxy';
const token='a'.repeat(36)+'.'+'b'.repeat(64);
describe('Vercel study persistence bridge',()=>{
 it('forwards only the study cookie, excluding other browser credentials',()=>{
  expect(studyCookieOnly(`vercel_auth=PRIVATE; crestwatch_study=${token}; other=SECRET`)).toBe('crestwatch_study='+token);
  expect(studyCookieOnly('crestwatch_study=bad; vercel_auth=PRIVATE')).toBeNull();
 });
 it('rejects cross-origin writes before contacting the database service',async()=>{
  const fetcher=vi.fn();const r=await proxyStudyRequest(new Request('https://crestwatch.vercel.app/api/participant',{method:'DELETE',headers:{Origin:'https://other.example'}}),fetcher);
  expect(r.status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
 });
 it('uses the routed Host when Next supplies an internal localhost URL',async()=>{
  const fetcher=vi.fn(async()=>Response.json({ok:true}));
  const r=await proxyStudyRequest(new Request('http://localhost:3000/api/participant',{method:'DELETE',headers:{Host:'127.0.0.1:3000',Origin:'http://127.0.0.1:3000'}}),fetcher);
  expect(r.status).toBe(200);expect(fetcher).toHaveBeenCalledOnce();
 });
 it('retains the session cookie and result while rewriting only the validated service origin',async()=>{
  const fetcher=vi.fn(async()=>Response.json({ok:true,session:{id:'qa'}},{status:201,headers:{'Set-Cookie':'crestwatch_study='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict'}}));
  const r=await proxyStudyRequest(new Request('https://crestwatch.vercel.app/api/participant',{method:'POST',headers:{Origin:'https://crestwatch.vercel.app','Content-Type':'application/json',Cookie:'private_account=SECRET; crestwatch_study='+token},body:'{"action":"create"}'}),fetcher);
  expect(r.status).toBe(201);expect(r.headers.get('set-cookie')).toContain('HttpOnly');expect(r.headers.get('cache-control')).toContain('no-store');
  const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://crestwatch-river-guide.utsavsresearch.chatgpt.site/api/participant');
  const headers=new Headers(init.headers);expect(headers.get('Origin')).toBe('https://crestwatch-river-guide.utsavsresearch.chatgpt.site');expect(headers.get('Cookie')).not.toContain('SECRET');
 });
 it('reports backend failure without leaking its response',async()=>{
  const r=await proxyStudyRequest(new Request('https://crestwatch.vercel.app/api/participant'),vi.fn(async()=>new Response('PRIVATE error details',{status:500})));
  expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE');
 });
});
