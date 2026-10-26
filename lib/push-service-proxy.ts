const ORIGIN='https://crestwatch-river-guide.utsavsresearch.chatgpt.site';
const headers={'Cache-Control':'no-store, private'};
export async function proxyPushRequest(request:Request,fetcher:typeof fetch=fetch){
 const url=new URL(request.url),origin=`${url.protocol}//${request.headers.get('host')||url.host}`;
 if(request.method!=='POST')return Response.json({ok:false},{status:405,headers});
 if(request.headers.get('origin')!==origin)return Response.json({ok:false,error:'Open CrestWatch to manage notifications.'},{status:403,headers});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({ok:false},{status:415,headers});
 try{
  const body=await request.text();if(body.length>5000)return Response.json({ok:false},{status:413,headers});
  const input=JSON.parse(body);if(!['subscribe','status','unsubscribe','test'].includes(input.action))return Response.json({ok:false},{status:400,headers});
  const res=await fetcher(ORIGIN+'/api/push',{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!res.headers.get('content-type')?.includes('application/json'))throw Error();
  return new Response(res.body,{status:res.status,headers:{...headers,'Content-Type':'application/json'}});
 }catch{return Response.json({ok:false,error:'Notification storage is unavailable. Please try again later.'},{status:503,headers});}
}
