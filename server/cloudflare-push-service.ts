import { env } from 'cloudflare:workers';
import { validPushSubscription, validPushWatch } from '@/lib/push-policy';
import { MONITOR_TOKEN_SHA256, VAPID_PUBLIC_KEY } from '@/lib/push-config';
import { rateLimitOk } from '@/lib/rate-limit';
const headers={'Cache-Control':'no-store, private'};
const result=(data:unknown,status=200)=>Response.json(data,{status,headers});
const hash=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const db=()=>{if(!env.DB)throw Error('No storage');return env.DB;};
export async function GET(){return result({ok:true,publicKey:VAPID_PUBLIC_KEY,retentionDays:90});}
export async function POST(request:Request){
 try {
  if(!request.headers.get('content-type')?.startsWith('application/json'))return result({ok:false,error:'JSON required.'},415);
  const text=await request.text();if(text.length>5000)return result({ok:false,error:'Request too large.'},413);
  const input=JSON.parse(text);
  const bearer=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  const monitor=bearer.length>20&&await hash(bearer)===MONITOR_TOKEN_SHA256;
  if(input.action==='monitor'||input.action==='ack') {
   if(!monitor)return result({ok:false,error:'Unauthorized.'},401);
   if(input.action==='monitor') {
    const now=Date.now();
    const rows=await db().prepare('SELECT id,endpoint,p256dh,auth,lid,threshold_tenths,was_above,test_requested,expires_at FROM push_subscriptions WHERE expires_at > ? ORDER BY id LIMIT 1000').bind(now).all();
    await db().prepare('DELETE FROM push_subscriptions WHERE expires_at <= ?').bind(now).run();
    return result({ok:true,subscriptions:rows.results});
   }
   if(typeof input.id!=='string'||!/^[a-f0-9]{64}$/.test(input.id))return result({ok:false,error:'Invalid ID.'},400);
   if(input.gone===true)await db().prepare('DELETE FROM push_subscriptions WHERE id=?').bind(input.id).run();
   else if(input.test===true)await db().prepare('UPDATE push_subscriptions SET test_requested=0,last_sent_at=? WHERE id=?').bind(Date.now(),input.id).run();
   else if(typeof input.above==='boolean')await db().prepare('UPDATE push_subscriptions SET was_above=?,last_sent_at=CASE WHEN ?=1 THEN ? ELSE last_sent_at END WHERE id=?').bind(input.above?1:0,input.sent===true?1:0,Date.now(),input.id).run();
   else return result({ok:false,error:'Invalid acknowledgement.'},400);
   return result({ok:true});
  }
  if(request.headers.get('origin')!==new URL(request.url).origin)return result({ok:false,error:'Open CrestWatch to manage your watch.'},403);
  if(!validPushSubscription(input.subscription))return result({ok:false,error:'Unsupported or invalid push subscription.'},400);
  if(!rateLimitOk('push|'+(request.headers.get('cf-connecting-ip')??'local')))return result({ok:false,error:'Too many requests. Please try later.'},429);
  const sub=input.subscription,id=await hash(sub.endpoint);
  const existing=await db().prepare('SELECT id,lid,threshold_tenths,auth,last_sent_at,expires_at FROM push_subscriptions WHERE id=?').bind(id).first<{id:string;lid:string;threshold_tenths:number;auth:string;last_sent_at:number|null;expires_at:number}>();
  if(existing&&existing.auth!==sub.keys.auth)return result({ok:false,error:'Subscription authentication failed.'},403);
  if(input.action==='status')return result({ok:true,watch:existing?{lid:existing.lid,threshold:existing.threshold_tenths/10,lastSentAt:existing.last_sent_at,expiresAt:existing.expires_at}:null});
  if(input.action==='unsubscribe'){if(existing)await db().prepare('DELETE FROM push_subscriptions WHERE id=?').bind(id).run();return result({ok:true});}
  if(input.action==='test'){if(!existing)return result({ok:false,error:'Save a watch first.'},404);await db().prepare('UPDATE push_subscriptions SET test_requested=1 WHERE id=?').bind(id).run();return result({ok:true,queued:true});}
  if(input.action!=='subscribe'||!validPushWatch(input.lid,input.threshold))return result({ok:false,error:'Select a gauge and a threshold from -20 to 100 ft in 0.1 ft steps.'},400);
  if(!existing){const count=await db().prepare('SELECT count(*) AS n FROM push_subscriptions').first<{n:number}>();if((count?.n??0)>=1000)return result({ok:false,error:'Watch capacity reached. Please use official alerts.'},503);}
  const now=Date.now(),expires=now+90*86400000;
  await db().prepare('INSERT INTO push_subscriptions (id,endpoint,p256dh,auth,lid,threshold_tenths,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET lid=excluded.lid,threshold_tenths=excluded.threshold_tenths,updated_at=excluded.updated_at,expires_at=excluded.expires_at,was_above=CASE WHEN lid=excluded.lid AND threshold_tenths=excluded.threshold_tenths THEN was_above ELSE 0 END').bind(id,sub.endpoint,sub.keys.p256dh,sub.keys.auth,input.lid,Math.round(input.threshold*10),now,now,expires).run();
  return result({ok:true,watch:{lid:input.lid,threshold:input.threshold,expiresAt:expires}},201);
 }catch{return result({ok:false,error:'Watch storage is unavailable. Try again later.'},503);}
}
