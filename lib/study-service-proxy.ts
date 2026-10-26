const SERVICE_ORIGIN = 'https://crestwatch-river-guide.utsavsresearch.chatgpt.site';
const STUDY_COOKIE = 'crestwatch_study';
const cacheHeaders = {'Cache-Control':'no-store, private'};
function unavailable(){return Response.json({ok:false,error:'Response storage is unavailable. Please try again later.'},{status:503,headers:cacheHeaders});}
export function studyCookieOnly(value:string|null){
 const cookie=value?.split(';').map(v=>v.trim()).find(v=>v.startsWith(STUDY_COOKIE+'='));
 return cookie && /^crestwatch_study=[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(cookie)?cookie:null;
}
/** Vercel serves the app; the existing private study service owns persistence. */
export async function proxyStudyRequest(request:Request,fetcher:typeof fetch=fetch){
 const write=request.method==='POST'||request.method==='DELETE';
 const url=new URL(request.url);
 const publicOrigin=`${url.protocol}//${request.headers.get('host')||url.host}`;
 if(write&&request.headers.get('origin')!==publicOrigin)return Response.json({ok:false,error:'Open the study link in your browser to continue.'},{status:403,headers:cacheHeaders});
 if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:cacheHeaders});
 if(!['GET','POST','DELETE'].includes(request.method))return new Response(null,{status:405,headers:{...cacheHeaders,Allow:'GET, POST, DELETE'}});
 try{
  const headers=new Headers();headers.set('Accept','application/json');
  const cookie=studyCookieOnly(request.headers.get('cookie'));if(cookie)headers.set('Cookie',cookie);
  if(write)headers.set('Origin',SERVICE_ORIGIN);
  let body:string|undefined;
  if(request.method==='POST'){body=await request.text();if(body.length>6000)return Response.json({ok:false,error:'This response is too large.'},{status:413,headers:cacheHeaders});headers.set('Content-Type','application/json');}
  const response=await fetcher(SERVICE_ORIGIN+'/api/participant',{method:request.method,headers,body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.headers.get('content-type')?.includes('application/json'))return unavailable();
  const resultHeaders=new Headers({...cacheHeaders,'Content-Type':'application/json'});
  const setCookie=response.headers.get('set-cookie');
  if(setCookie?.startsWith(STUDY_COOKIE+'='))resultHeaders.set('Set-Cookie',setCookie);
  return new Response(response.body,{status:response.status,headers:resultHeaders});
 }catch{return unavailable();}
}
