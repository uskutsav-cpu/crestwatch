// Explicit software QA only. Always withdraws the records it creates.
import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base)throw Error('Pass an explicit local or deployed Site origin.');
const origin=new URL(base).origin;
const cookies=[];
async function call(method='GET',body,cookie='',expected=200,foreign=false){
 const r=await fetch(origin+'/api/participant',{method,headers:{...(method!=='GET'?{'Origin':foreign?'https://invalid.example':origin}:{}),...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}assert.equal(r.status,expected,JSON.stringify(data));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};
}
try{
 assert.equal((await call()).data.session,null);
 await call('POST',{action:'create',version:'self-guided-2026-10-v2',consent:true,familiarity:'none',device:'desktop'},'',403,true);
 let first=await call('POST',{action:'create',version:'self-guided-2026-10-v2',consent:true,familiarity:'none',device:'desktop'},'',201);cookies.push(first.cookie);
 let second=await call('POST',{action:'create',version:'self-guided-2026-10-v2',consent:true,familiarity:'some',device:'phone'},'',201);cookies.push(second.cookie);
 const id=first.data.session.id;
 assert.notEqual(id,second.data.session.id);
 assert.equal((await call('GET',undefined,first.cookie)).data.session.id,id);
 await call('POST',{action:'start',step:5},first.cookie,409);
 await call('POST',{action:'answer',step:0,answer:'SOFTWARE QA',help:'none'},first.cookie,400);
 for(let step=0;step<6;step++){
  const start=await call('POST',{action:'start',step},first.cookie);
  const repeat=await call('POST',{action:'start',step},first.cookie);
  assert.equal(start.data.session.startedAt,repeat.data.session.startedAt);
  await call('POST',{action:'stop',step,outcome:step===1?'technical_problem':step===2?'skipped':'ready'},first.cookie);
  await call('POST',{action:'answer',step,answer:'SOFTWARE QA: automated persistence verification, not a participant result.',help:'made-up'},first.cookie,400);
  await call('POST',{action:'answer',step,answer:'SOFTWARE QA confidence validation',help:'none',confidence:6},first.cookie,400);
  const saved=await call('POST',{action:'answer',step,answer:step===2?'':'SOFTWARE QA: automated persistence verification, not a participant result.',help:step===3?'ai':'none',confidence:3},first.cookie);
  assert.equal(saved.data.session.nextIndex,step+1);
  const retried=await call('POST',{action:'answer',step,answer:'SOFTWARE QA retry',help:'none'},first.cookie);
  assert.equal(retried.data.session.nextIndex,step+1);
 }
 assert.equal((await call('GET',undefined,first.cookie)).data.session.finished,true);
 assert.equal((await call('GET',undefined,second.cookie)).data.session.nextIndex,0);
 assert.equal((await call()).data.session,null);
 await call('DELETE',undefined,first.cookie,403,true);
 await call('DELETE',undefined,first.cookie);cookies.splice(cookies.indexOf(first.cookie),1);
 assert.equal((await call('GET',undefined,first.cookie)).data.session,null);
 assert.equal((await call('GET',undefined,second.cookie)).data.session.id,second.data.session.id);
 console.log('PASS: six tasks saved, retry/resume/isolation/validation/withdrawal verified. Software QA only.');
}finally{
 for(const cookie of cookies){await call('DELETE',undefined,cookie);assert.equal((await call('GET',undefined,cookie)).data.session,null);}
 console.log('All API-created software QA records withdrawn.');
}
