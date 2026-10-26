import { env } from 'cloudflare:workers';
import { assignedTask, ATTEMPT_OUTCOMES, PARTICIPANT_VERSION, publicSession, stopAttempt, validParticipantAnswer, type ParticipantSession, type AttemptOutcome } from '@/lib/participant-study';
import { rateLimitOk, clientIp } from '@/lib/rate-limit';
const COOKIE = 'crestwatch_study';
const noStore = {'Cache-Control':'no-store, private'};
function result(data:unknown,status=200,extra:Record<string,string>={}) { return Response.json({...data as Record<string,unknown>,serverNow:Date.now()},{status,headers:{...noStore,...extra}}); }
function db() { if (!env.DB) throw Error('STORAGE_UNAVAILABLE'); return env.DB; }
async function hash(token:string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
function cookieValue(request:Request) { return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) ?? ''; }
async function session(request:Request) {
 const value=cookieValue(request);
 if(!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value)) return null;
 const [id,token]=value.split('.');
 return db().prepare('SELECT id, condition_order, created_at, study_version, familiarity, device, next_index, current_started_at, current_stopped_at, current_outcome, finished_at FROM participant_sessions WHERE id = ? AND token_hash = ?').bind(id,await hash(token)).first<ParticipantSession>();
}
function cookie(request:Request,value:string,clear=false) { return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:604800}${new URL(request.url).protocol==='https:'?'; Secure':''}`; }
const sameOrigin=(request:Request)=>request.headers.get('origin')===new URL(request.url).origin;
export async function GET(request:Request) {
 try {const s=await session(request);return result({ok:true,session:s?publicSession(s):null});}
 catch {return result({ok:false,error:'Response storage is unavailable. Please try again later.'},503);}
}
export async function POST(request:Request) {
 if(!sameOrigin(request)||!request.headers.get('content-type')?.startsWith('application/json')) return result({ok:false,error:'Open the study link in your browser to continue.'},403);
 try {
  const text=await request.text();if(text.length>6000)return result({ok:false,error:'This response is too large.'},413);
  let input:any;try{input=JSON.parse(text);}catch{return result({ok:false,error:'Invalid request.'},400);}
  if(!input||typeof input!=='object')return result({ok:false,error:'Invalid request.'},400);
  if(input.action==='create') {
   const existing=await session(request);if(existing)return result({ok:true,session:publicSession(existing)});
   if(input.consent!==true||!['none','some','frequent'].includes(input.familiarity)||!['phone','tablet','desktop'].includes(input.device))return result({ok:false,error:'Please confirm your choice to participate and select your familiarity.'},400);
   if(!rateLimitOk('participant-create|'+clientIp(request.headers)))return result({ok:false,error:'Too many study starts. Please try again later.'},429);
   const count=await db().prepare('SELECT COUNT(*) AS n FROM participant_sessions WHERE created_at >= ?').bind(Date.now()-86400000).first<{n:number}>();
   if((count?.n??0)>=1000)return result({ok:false,error:'The study is temporarily full. Please try again later.'},429);
   const id=crypto.randomUUID(), token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
   const order=crypto.getRandomValues(new Uint8Array(1))[0]%2===0?'crestwatch':'official';
   await db().prepare('INSERT INTO participant_sessions (id,token_hash,condition_order,created_at,study_version,familiarity,device,next_index) VALUES (?,?,?,?,?,?,?,0)').bind(id,await hash(token),order,Date.now(),PARTICIPANT_VERSION,input.familiarity,input.device).run();
   const s=await db().prepare('SELECT * FROM participant_sessions WHERE id=?').bind(id).first<ParticipantSession>();
   return result({ok:true,session:publicSession(s!)},201,{'Set-Cookie':cookie(request,id+'.'+token)});
  }
  const s=await session(request);if(!s)return result({ok:false,error:'Your study session was not found. Please reopen the study link.'},401);
  if(!rateLimitOk('participant-write|'+s.id))return result({ok:false,error:'Too many requests. Please wait and try again.'},429);
  if(!Number.isInteger(input.step)||input.step<0||input.step>5)return result({ok:false,error:'Invalid task.'},400);
  if(input.step<s.next_index)return result({ok:true,session:publicSession(s)}); // retry after a saved answer
  if(s.finished_at!==null||input.step!==s.next_index)return result({ok:false,error:'Please reload to resume the current task.'},409);
  const task=assignedTask(s.condition_order,s.next_index)!;
  if(input.action==='start') {
   await db().prepare('UPDATE participant_sessions SET current_started_at=? WHERE id=? AND next_index=? AND current_started_at IS NULL').bind(Date.now(),s.id,s.next_index).run();
  } else if(input.action==='stop') {
   if(s.current_started_at===null||!ATTEMPT_OUTCOMES.includes(input.outcome))return result({ok:false,error:'Start the task first.'},400);
   const stopped=stopAttempt(s.current_started_at,Date.now(),input.outcome as AttemptOutcome);
   await db().prepare('UPDATE participant_sessions SET current_stopped_at=?, current_outcome=? WHERE id=? AND next_index=? AND current_stopped_at IS NULL').bind(stopped.stoppedAt,stopped.outcome,s.id,s.next_index).run();
  } else if(input.action==='answer') {
   if(s.current_started_at===null||s.current_stopped_at===null||s.current_outcome===null||!validParticipantAnswer(input.answer,input.help,s.current_outcome))return result({ok:false,error:'Please enter your answer (up to 1,500 characters) and select any help used.'},400);
   const now=Date.now();
   await db().batch([
    db().prepare('INSERT OR IGNORE INTO participant_attempts (id,session_id,step,condition,task,started_at,stopped_at,lookup_ms,outcome,answer,help,submitted_at) SELECT ?,id,next_index,?,?,?,?,?,?,?,?,? FROM participant_sessions WHERE id=? AND next_index=? AND current_stopped_at IS NOT NULL').bind(crypto.randomUUID(),task.condition,task.id,s.current_started_at,s.current_stopped_at,Math.max(0,s.current_stopped_at-s.current_started_at),s.current_outcome,input.answer.trim(),input.help,now,s.id,s.next_index),
    db().prepare('UPDATE participant_sessions SET next_index=next_index+1, current_started_at=NULL, current_stopped_at=NULL, current_outcome=NULL, finished_at=CASE WHEN next_index=5 THEN ? ELSE NULL END WHERE id=? AND next_index=? AND EXISTS (SELECT 1 FROM participant_attempts WHERE session_id=? AND step=?)').bind(now,s.id,s.next_index,s.id,s.next_index),
   ]);
  } else return result({ok:false,error:'Unknown study action.'},400);
  const updated=await db().prepare('SELECT * FROM participant_sessions WHERE id=?').bind(s.id).first<ParticipantSession>();
  return result({ok:true,session:publicSession(updated!)});
 } catch {return result({ok:false,error:'Your response could not be saved. Keep this page open and try again.'},503);}
}
export async function DELETE(request:Request) {
 if(!sameOrigin(request))return result({ok:false,error:'Open the study link in your browser to withdraw.'},403);
 try {
  const s=await session(request);
  if(s)await db().batch([db().prepare('DELETE FROM participant_attempts WHERE session_id=?').bind(s.id),db().prepare('DELETE FROM participant_sessions WHERE id=?').bind(s.id)]);
  return result({ok:true,removed:!!s},200,{'Set-Cookie':cookie(request,'',true)});
 }catch{return result({ok:false,error:'Could not remove your response. Please try again.'},503);}
}
