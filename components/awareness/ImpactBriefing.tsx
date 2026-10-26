"use client";
import { ArrowUpRight, Bell, CheckCheck, History } from 'lucide-react';
import { impactBriefing } from '@/lib/flood-awareness';
import { timeLabel } from '@/lib/river-stations';
import type { RiverDetail } from '@/components/experience/Dashboard';
export function ImpactBriefing({lid,city,detail,now,nextAppCheck}:{lid:string;city:string;detail:RiverDetail;now:number;nextAppCheck:number|null}) {
 const b=impactBriefing(detail.forecast,detail.forecastIssued,detail.categories.minor??null,detail.impacts,now);
 return <section className="awareness-brief" aria-labelledby="awareness-brief-title">
  <div className="section-heading"><div><span className="eyebrow">Your gauge briefing · {city}</span><h2 id="awareness-brief-title">What the forecast says</h2></div><a className="text-button" href={`https://water.noaa.gov/gauges/${lid}`} target="_blank" rel="noreferrer">Official forecast <ArrowUpRight size={15}/></a></div>
  <div className="awareness-metrics"><div><span>Highest future forecast sample</span><strong>{b.high?`${b.high.stageFt.toFixed(1)} ft`:'Unavailable'}</strong><small>{b.high?timeLabel(b.high.t):'A fresh, dated forecast is needed.'}</small></div><div><span>Official flood stage</span><strong>{detail.categories.minor!=null?`${detail.categories.minor} ft`:'Unpublished'}</strong><small>{b.difference!==null?`${Math.abs(b.difference).toFixed(1)} ft ${b.difference>=0?'above':'below'} flood stage at the forecast high`:'Comparison unavailable'}</small></div></div>
  <p className="brief-meaning">{b.status==='reached'?`The first future forecast sample at or above flood stage is ${timeLabel(b.first?.t)}. This is sample timing, not the start of flooding at a property.`:b.status==='below'?'The published future forecast samples stay below flood stage at this gauge. That does not rule out flooding from rain, drainage, tributaries, or other causes.':'The flood-stage comparison is unavailable. The threshold or a fresh future forecast is missing. Check the official station before making decisions.'}</p>
  {b.high&&(b.reached||b.next)&&<blockquote><span className="eyebrow">Official impact note · {(b.reached??b.next)!.stage} ft · {b.reached?'at or below forecast high':'above forecast high'}</span><p>{(b.reached??b.next)!.statement}</p></blockquote>}
  <div className="brief-timestamps"><span>Forecast issued: {timeLabel(detail.forecastIssued)}</span><span>App checked: {timeLabel(detail.checkedAt)}</span><span>Next app check scheduled: {timeLabel(nextAppCheck?new Date(nextAppCheck).toISOString():null)} while open</span></div>
  <div className="awareness-links"><a href={`/compare?station=${lid}`}><History size={17}/>Compare past crests</a><a href={`/notifications?station=${lid}`}><Bell size={17}/>Watch a threshold</a><a href={`/prepare?station=${lid}`}><CheckCheck size={17}/>Make a household plan</a></div>
 </section>;
}
