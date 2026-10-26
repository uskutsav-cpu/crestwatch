import { ArrowUpRight, History } from 'lucide-react';
import { SiteLink } from './SiteLink';
import { HISTORICAL_RECORDS, historyPoints } from '@/lib/history-records';
import { replaySummary, splitDailySegments } from '@/lib/replay-summary';
export function HistoryGallery() {
 return <section className="history-gallery" id="river-memory" aria-labelledby="memory-title">
  <div className="section-heading"><div><span className="eyebrow">03 / THE RIVER HAS A MEMORY</span><h2 id="memory-title">Replay a recorded flood.</h2></div><SiteLink className="text-button" href="/replay">Explore all three <ArrowUpRight size={16}/></SiteLink></div>
  <p className="history-intro">Watch the water rise and recede using recorded daily readings.</p>
  <div className="history-cards">{HISTORICAL_RECORDS.map((record,i)=>{
    const points=historyPoints(record.id), summary=replaySummary(points,null);
    const lo=Math.min(...points.map(p=>p.stageFt)), hi=Math.max(...points.map(p=>p.stageFt));
    const start=Date.parse(points[0].t),end=Date.parse(points.at(-1)!.t);
    const x=(t:string)=>8+(Date.parse(t)-start)/(end-start)*284;
    const y=(v:number)=>78-(v-lo)/Math.max(1,hi-lo)*60;
    const paths=splitDailySegments(points).map(group=>group.map((p,j)=>`${j?'L':'M'}${x(p.t).toFixed(1)},${y(p.stageFt).toFixed(1)}`).join(' '));
    return <SiteLink key={record.id} href={`/replay?event=${record.id}`} className={`history-card history-card-${i}`}>
      <div className="history-card-top"><span>{record.period}</span><ArrowUpRight size={20}/></div>
      <div className="history-year">{record.year}</div><h3>{record.name}</h3><p>{record.place}</p>
      <svg viewBox="0 0 300 94" role="img" aria-label={`Recorded daily-mean trend for ${record.year}. Highest daily mean ${summary.peak?.stageFt.toFixed(2)} ${record.unit}. Each card uses its own scale.`}>
        {[24,51,78].map(n=><line key={n} x1="8" x2="292" y1={n} y2={n} stroke="currentColor" opacity=".12"/>)}
        {paths.map((d,j)=><path key={j} d={d} fill="none" stroke="currentColor" strokeWidth="2"/>)}
        {summary.peak&&<circle cx={x(summary.peak.t)} cy={y(summary.peak.stageFt)} r="4" fill="currentColor"/>}
      </svg>
      <div className="history-card-bottom"><span><History size={13}/>{summary.samples} daily readings{summary.missingDays?` · ${summary.missingDays} missing ${summary.missingDays === 1 ? 'date' : 'dates'}`:''}</span><span>Replay <ArrowUpRight size={13}/></span></div>
    </SiteLink>;
  })}</div>
  <p className="history-scale-note">Recorded USGS daily means. Each preview uses its own scale; heights cannot be compared across cards. Daily means differ from instantaneous crests.</p>
 </section>;
}
