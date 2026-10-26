"use client";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { STATIONS, timeLabel, isFresh } from '@/lib/river-stations';
import type { RiverDetail } from '@/components/experience/Dashboard';
import { impactBriefing } from '@/lib/flood-awareness';
export function GaugeCompare() {
 const search=useSearchParams(); const initial=search.get('station');
 const [lid,setLid]=useState(STATIONS.some(s=>s.lid===initial)?initial!:'JACM6');
 const [now,setNow]=useState(Date.now());
 const [detail,setDetail]=useState<RiverDetail|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState('');
 useEffect(()=>{let dead=false;setDetail(null);setError(false);fetch(`/api/river/${lid}`).then(async r=>{const d=await r.json() as RiverDetail;if(!r.ok||!d.ok)throw Error();if(!dead)setDetail(d);}).catch(()=>{if(!dead)setError(true);});return()=>{dead=true;};},[lid,attempt]);
 useEffect(()=>{setSelected('');},[lid]);
 useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),60000);const refresh=setInterval(()=>setAttempt(a=>a+1),900000);return()=>{clearInterval(clock);clearInterval(refresh);};},[]);
 const crests=detail?.crests??[];const crest=crests.find(c=>`${c.date}|${c.stage}`===selected)??crests[0];
 const obs=detail?.observed.filter(p=>isFresh(p.t,2,now)).at(-1);
 const b=detail?impactBriefing(detail.forecast,detail.forecastIssued,detail.categories.minor??null,detail.impacts,now):null;
 const min=Math.min(0,obs?.stageFt??0,b?.high?.stageFt??0,crest?.stage??0);
 const max=Math.max(1,crest?.stage??0,b?.high?.stageFt??0,obs?.stageFt??0,detail?.categories.minor??0)*1.1;
 return <div className="awareness-page"><div className="page-title"><span className="eyebrow">Past and present · same gauge</span><h1>How does today compare?</h1><p>Compare an observation and the official forecast with a recorded historical crest at the same river gauge.</p></div><label className="awareness-field">River gauge<select value={lid} onChange={e=>setLid(e.target.value)}>{STATIONS.map(s=><option key={s.lid} value={s.lid}>{s.name} · {s.city}</option>)}</select></label>
 {error?<div className="notice" role="status">The official feed did not respond. <button onClick={()=>setAttempt(a=>a+1)}>Try again</button></div>:!detail?<p role="status">Loading the official record…</p>:<>
 <label className="awareness-field">Historical crest<select value={crest?`${crest.date}|${crest.stage}`:''} onChange={e=>setSelected(e.target.value)} disabled={!crests.length}>{crests.length?crests.map(c=><option key={`${c.date}-${c.stage}`} value={`${c.date}|${c.stage}`}>{c.date} · {c.stage.toFixed(2)} ft</option>):<option>No comparable crest published</option>}</select></label>
 <section className="comparison-chart" aria-label="Same-gauge river-level comparison">{[{label:'Recent observation',value:obs?.stageFt,date:obs?timeLabel(obs.t):'Recent observation unavailable'},{label:'Official forecast high',value:b?.high?.stageFt,date:b?.high?timeLabel(b.high.t):'Fresh future forecast unavailable'},{label:'Historical crest',value:crest?.stage,date:crest?.date??'No current-datum crest available'}].map(row=><div className="comparison-row" key={row.label}><div><strong>{row.label}</strong><span>{row.value!==undefined?`${row.value.toFixed(2)} ft`:'Unavailable'}</span></div><div className="comparison-track"><i style={{width:row.value!==undefined?`${(row.value-min)/(max-min)*100}%`:'0%'}}/></div><small>{row.date}</small></div>)}</section>
 {crest&&b?.high&&<p className="comparison-takeaway">The forecast high is <strong>{Math.abs(crest.stage-b.high.stageFt).toFixed(2)} ft {b.high.stageFt>crest.stage?'above':'below'}</strong> the {crest.date} crest at this gauge.</p>}
 <div className="uncertainty-note"><h2>A forecast is one expected path</h2><p>Rainfall, runoff and upstream releases can change. The high shown here is the highest sample in the published forecast, not a guaranteed maximum. No probability range is inferred from this line.</p><a href={`https://water.noaa.gov/gauges/${lid}`} target="_blank" rel="noreferrer">Check official forecasts and available probabilistic guidance ↗</a></div>
 <p className="small">Historical crests come from NOAA’s current-datum crest list. Old-datum entries are excluded. Crests are instantaneous peaks; the replay uses daily means, which smooth short peaks.</p><div className="awareness-links"><a href={`/?station=${lid}#rivers`}>Back to this gauge</a><a href="/replay">Replay daily records</a><a href={`/impact-map?station=${lid}`}>Explore map coverage</a></div></>}
 </div>;
}
