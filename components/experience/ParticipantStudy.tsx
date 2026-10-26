"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock3, LoaderCircle, Waves } from 'lucide-react';
import { TASK_LIMIT_MS, PARTICIPANT_VERSION, type AttemptOutcome, type publicSession } from '@/lib/participant-study';
type Session=ReturnType<typeof publicSession>;
type ApiResponse={ok:boolean;error?:string;serverNow:number;session:Session|null;removed?:boolean};
export function ParticipantStudy() {
 const [session,setSession]=useState<Session|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [consent,setConsent]=useState(false),[familiarity,setFamiliarity]=useState(''),[answer,setAnswer]=useState(''),[help,setHelp]=useState(''),[confidence,setConfidence]=useState('');
 const [offset,setOffset]=useState(0),[clock,setClock]=useState(Date.now()),[withdraw,setWithdraw]=useState(false),[withdrawn,setWithdrawn]=useState(false);
 const autoStop=useRef('');
 async function request(action:string,extra:Record<string,unknown>={}) {
  setBusy(true);setError('');
  try {
   const r=await fetch('/api/participant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,step:session?.nextIndex,...extra})});
   const data=await r.json() as ApiResponse;if(!r.ok||!data.ok)throw Error(data.error||'Could not save. Please try again.');
   setOffset(data.serverNow-Date.now());setSession(data.session);return true;
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Please try again.');return false;}
  finally{setBusy(false);}
 }
 useEffect(()=>{let live=true;fetch('/api/participant',{cache:'no-store'}).then(async r=>await r.json() as ApiResponse).then(data=>{if(!live)return;if(!data.ok)throw Error(data.error);setSession(data.session);setOffset(data.serverNow-Date.now());}).catch(()=>{if(live)setError('The study could not open. Reload this page to try again.');}).finally(()=>{if(live)setLoaded(true);});return()=>{live=false;};},[]);
 useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(id);},[]);
 const draftKey=session?`crestwatch.participant.${session.id}.${session.nextIndex}`:'';
 useEffect(()=>{
  setAnswer('');setHelp('');setConfidence('');autoStop.current='';
  if(draftKey)try{const draft=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(draft){setAnswer(draft.answer||'');setHelp(draft.help||'');setConfidence(draft.confidence||'');}}catch{}
 },[draftKey]);
 function draft(nextAnswer:string,nextHelp:string,nextConfidence=confidence) {setAnswer(nextAnswer);setHelp(nextHelp);setConfidence(nextConfidence);if(draftKey)try{sessionStorage.setItem(draftKey,JSON.stringify({answer:nextAnswer,help:nextHelp,confidence:nextConfidence}));}catch{}}
 const searching=!!session?.startedAt&&!session?.stoppedAt;
 const elapsed=session?.startedAt?Math.min(TASK_LIMIT_MS,Math.max(0,(session.stoppedAt??clock+offset)-session.startedAt)):0;
 useEffect(()=>{
  if(searching&&elapsed>=TASK_LIMIT_MS&&!busy&&session&&autoStop.current!==draftKey){autoStop.current=draftKey;void request('stop',{outcome:'time_limit'});}
 },[searching,elapsed,busy,draftKey]);
 async function removeResponse(){
  setBusy(true);setError('');try{const r=await fetch('/api/participant',{method:'DELETE'});const data=await r.json() as ApiResponse;if(!r.ok||!data.ok)throw Error(data.error||'Could not remove the response.');setSession(null);setWithdraw(false);setWithdrawn(true);if(draftKey)sessionStorage.removeItem(draftKey);}catch{setError('Could not remove your response. Please keep this page open and try again.');}finally{setBusy(false);}
 }
 const task=session?.task;
 const interfaceName=task?.condition==='crestwatch'?'CrestWatch':'official NOAA page';
 const phase=!session?'intro':session.finished?'done':!session.startedAt?'ready':!session.stoppedAt?'searching':'answer';
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[session?.nextIndex,session?.finished]);
 const outcomeLabels:Record<AttemptOutcome,string>={ready:'You are ready to answer',could_not_complete:'You could not finish',technical_problem:'The page had a technical problem',skipped:'You chose to skip',time_limit:'The two-minute search limit was reached'};
 return <div className="participant-shell">
  <header className="participant-header"><span className="participant-brand"><Waves size={25}/> CrestWatch <small>RESEARCH</small></span><span>Anonymous · about 10–15 minutes</span></header>
  <main className="participant-main">
   {!loaded?<div className="participant-loading"><LoaderCircle className="spin" size={22}/> Opening the study…</div>:<>
   {error&&<div role="alert" className="participant-error">{error}</div>}
   {withdrawn?<section className="participant-card"><Check size={32}/><h1>Your saved response was removed.</h1><p>Thank you for your time. You can close this tab.</p></section>:phase==='intro'?<>
    <span className="eyebrow">A SHORT, VOLUNTARY COMPARISON</span><h1>Help make river<br/><em>information clearer.</em></h1>
    <p className="participant-lead">Try two ways to read river information. Tell us what you find, what you understand, and where you get stuck.</p>
    <div className="participant-steps"><div><span>01</span><strong>Try both pages</strong><p>Three short tasks on each. The order is assigned randomly.</p></div><div><span>02</span><strong>Use your own words</strong><p>We are testing the information, not you. Unfinished tasks are useful results.</p></div><div><span>03</span><strong>Submit as you go</strong><p>Each answer saves privately to the project. No account or email needed.</p></div></div>
    <section className="participant-card">
     <h2>Before you begin.</h2><p>Keep this study tab open. Each task opens a river page in another tab. Please try without help from others; you can record any help you use.</p>
     <p>Take part once, on one device. Each search has a two-minute limit. If a page fails or you cannot find something, record that instead of guessing.</p>
     <label className="participant-field">How often have you used river-gauge information?<select value={familiarity} onChange={e=>setFamiliarity(e.target.value)}><option value="">Choose one</option><option value="none">Never or almost never</option><option value="some">A few times</option><option value="frequent">Regularly</option></select></label>
     <label className="participant-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I am 18 or older and choose to participate. I understand I can stop or withdraw my saved response.</span></label>
     <button className="primary-button" disabled={!consent||!familiarity||busy||!!error} onClick={()=>void request('create',{consent:true,familiarity,version:PARTICIPANT_VERSION,device:innerWidth<600?'phone':innerWidth<1000?'tablet':'desktop'})}>{busy?<LoaderCircle className="spin" size={17}/>:null} Begin comparison <ArrowRight size={17}/></button>
    </section>
    <details className="participant-privacy"><summary>What is collected, and who can see it?</summary><p>We save a random study code, assigned page order, task times, your answers, help used, completion status, confidence ratings, device category and river-data familiarity in the CrestWatch project database. The project researcher can review them; responses are not published by this study page.</p><p>Do not enter your name, email, home address or other private details. We do not store your IP address in study records, although the hosting service may process request metadata. A secure session cookie lets this browser resume or withdraw its response for seven days. Answers typed but not saved may be held in this tab’s session storage. Closing a tab does not withdraw answers already saved.</p><p>Participation is optional. Use the withdrawal control on this page to remove your saved answers while your session cookie remains available. This study does not provide emergency or property flood-safety advice.</p></details>
   </>:phase==='done'?<section className="participant-card participant-thanks">
    <span className="participant-check"><Check size={30}/></span><span className="eyebrow">6 OF 6 TASKS SAVED</span><h1>Thank you.<br/><em>Every attempt counts.</em></h1><p>Your responses were submitted privately. Answers you could not find, skipped tasks and technical problems are included. The researcher will assess explanations separately; this page does not mark your answers correct.</p><p className="participant-receipt">Your response code: <strong>{session?.id}</strong></p><p>You may close this tab. To withdraw, return to this link in the same browser within seven days while its session cookie is available.</p><a className="secondary-button" href="/">Explore CrestWatch <ArrowUpRight size={16}/></a>
   </section>:task&&session?<>
    <div className="participant-progress"><span>PAGE {session.nextIndex<3?'1':'2'} OF 2 · TASK {session.nextIndex%3+1} OF 3</span><span>{session.nextIndex} / 6 saved</span></div>
    <div className="participant-progress-bar" aria-label={`${session.nextIndex} of 6 tasks saved`}><span style={{width:`${session.nextIndex/6*100}%`}}/></div>
    <section className="participant-card participant-task" key={session.nextIndex}>
     <span className="eyebrow">USING {interfaceName.toUpperCase()}</span><h1>{task.title}.</h1><blockquote>{task.prompt}</blockquote>
     {phase==='ready'?<><p>Press Start, open the assigned page, then return here when you are ready to answer. Search time includes opening and using that page. You have up to two minutes; you can also report that you could not finish.</p><button className="primary-button" disabled={busy} onClick={()=>void request('start')}>{busy?<LoaderCircle className="spin" size={16}/>:<Clock3 size={16}/>} Start this task <ArrowRight size={16}/></button></>:null}
     {phase==='searching'?<>
      <div className="participant-timer"><Clock3 size={18}/><strong>{Math.max(0,Math.ceil((TASK_LIMIT_MS-elapsed)/1000))}</strong><span>seconds remaining</span></div>
      <a className="primary-button" href={task.href} target="_blank" rel="noreferrer">Open {interfaceName} <ArrowUpRight size={18}/></a>
      <p>Read the assigned page, then come back to this tab. Choose what happened to stop the search timer.</p>
      <div className="participant-outcomes">
       <button className="secondary-button" disabled={busy} onClick={()=>void request('stop',{outcome:'ready'})}>I’m ready to answer <ArrowRight size={15}/></button>
       <button className="secondary-button" disabled={busy} onClick={()=>void request('stop',{outcome:'could_not_complete'})}>I couldn’t finish</button>
       <button className="text-button" disabled={busy} onClick={()=>void request('stop',{outcome:'technical_problem'})}>The page didn’t work</button>
       <button className="text-button" disabled={busy} onClick={()=>void request('stop',{outcome:'skipped'})}>Skip this task</button>
      </div>
     </>:null}
     {phase==='answer'?<form onSubmit={async e=>{e.preventDefault();const saved=await request('answer',{answer,help,confidence:confidence?Number(confidence):null});if(saved&&draftKey)try{sessionStorage.removeItem(draftKey);}catch{}}}>
      <div className="participant-stopped"><Check size={17}/>{outcomeLabels[session.outcome!]}. Search time: {(elapsed/1000).toFixed(1)} seconds.</div>
      <label className="participant-field">Your answer, in your own words{session.outcome!=='ready'?' (optional)':''}<textarea maxLength={1500} rows={6} value={answer} required={session.outcome==='ready'} minLength={session.outcome==='ready'?3:undefined} onChange={e=>draft(e.target.value,help)} placeholder={session.outcome==='ready'?'What did you find, and how do you interpret it?':'What got in the way? Record any partial answer you found.'}/></label>
      <small className="participant-answer-note">Please answer from what you found. Do not enter personal details. There is no correctness feedback between pages.</small>
      <label className="participant-field">Did you use help during this task?<select value={help} required onChange={e=>draft(answer,e.target.value)}><option value="">Choose one</option><option value="none">No help</option><option value="person">Help from another person</option>{help==='ai'?<option value="ai">Other help (previous answer)</option>:null}<option value="other">Other help</option><option value="not_sure">Not sure</option></select></label>
      <label className="participant-field">How confident are you in your response?<select value={confidence} required onChange={e=>draft(answer,help,e.target.value)}><option value="">Choose one</option><option value="1">1 · Not at all confident</option><option value="2">2 · Slightly confident</option><option value="3">3 · Moderately confident</option><option value="4">4 · Very confident</option><option value="5">5 · Extremely confident</option></select></label>
      <button className="primary-button" type="submit" disabled={busy||!help||!confidence||(session.outcome==='ready'&&answer.trim().length<3)}>{busy?<LoaderCircle className="spin" size={16}/>:null}{session.nextIndex===5?'Submit final response':'Save answer & continue'} <ArrowRight size={17}/></button>
     </form>:null}
    </section><p className="participant-save-note">Previously saved answers stay saved if you stop. Unfinished sessions remain part of the study; they are not automatically counted as complete or correct.</p>
   </>:null}
   {session&&!withdrawn?<div className="participant-withdraw">{withdraw?<><p>Remove this browser’s saved study response and all its task answers?</p><button className="secondary-button" disabled={busy} onClick={()=>void removeResponse()}>Remove my saved response</button><button className="text-button" disabled={busy} onClick={()=>setWithdraw(false)}>Keep my response</button></>:<button className="text-button" onClick={()=>setWithdraw(true)}>Withdraw my saved response</button>}</div>:null}
   </>}
   <footer className="participant-footer">CrestWatch comparison study · Official forecasts remain at water.noaa.gov</footer>
  </main>
 </div>;
}
