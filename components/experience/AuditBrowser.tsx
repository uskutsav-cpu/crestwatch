"use client";
import { useState } from 'react';
import { filterAuditChecks, readableAuditValue, type AuditCheck } from '@/lib/automated-audit';
import { STATIONS } from '@/lib/river-stations';
export function AuditBrowser() {
 const [rows,setRows]=useState<AuditCheck[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [gauge,setGauge]=useState(''),[kind,setKind]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0);
 async function load(){setBusy(true);setError('');try{const r=await fetch('/evidence/automated-audit-index.json');if(!r.ok)throw Error();const data=await r.json() as AuditCheck[];if(!Array.isArray(data)||data.length!==1000)throw Error();setRows(data);}catch{setError('The check browser could not load. Retry, or download the original CSV above.');}finally{setBusy(false);}}
 if(!rows)return <div className="audit-browser"><button className="secondary-button" disabled={busy} onClick={()=>void load()}>{busy?'Loading audit records…':error?'Retry loading records':'Browse the 1,000 recorded checks'}</button>{error&&<p role="alert">{error}</p>}</div>;
 const filtered=filterAuditChecks(rows,gauge,kind,search),last=Math.max(0,Math.ceil(filtered.length/20)-1),shown=filtered.slice(page*20,page*20+20);
 return <div className="audit-browser">
  <h3>Inspect a recorded check.</h3><p>These are the supplied audit records, not a fresh test run. Full captured text and all original columns are in the CSV.</p>
  <div className="audit-filters">
   <label>Gauge<select value={gauge} onChange={e=>{setGauge(e.target.value);setPage(0);}}><option value="">All four gauges</option>{STATIONS.map(s=><option key={s.lid} value={s.lid}>{s.city} · {s.lid}</option>)}</select></label>
   <label>Coverage<select value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="">All checks</option><option value="slider">Impact-slider scenarios</option><option value="other">Other behavior</option></select></label>
   <label>Search<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Check ID, name or finding"/></label>
  </div>
  <p className="audit-count" role="status">{filtered.length.toLocaleString('en-US')} matching records{filtered.length?` · showing ${page*20+1}–${Math.min(page*20+20,filtered.length)}`:''}</p>
  {!shown.length?<p>No checks match these filters.</p>:<ol className="audit-records">{shown.map(r=><li key={r.check_id}>
   <div className="audit-record-heading"><span>{r.check_id} · {r.category.replaceAll('_',' ')}</span><span>Recorded {r.status}{r.severity==='LOW'?' · low-severity note':''}</span></div>
   <strong>{r.test_name}</strong>
   <details><summary aria-label={`Inspect record ${r.check_id}`}>Inspect record</summary>
    {r.finding&&<p>{r.finding}</p>}{r.notes&&<p>{r.notes}</p>}
    <h4>Expected</h4><pre>{readableAuditValue(r.expected_result)}</pre><h4>Recorded result</h4><pre>{readableAuditValue(r.actual_result)}</pre>
    {r.reproduction_steps&&<><h4>Recorded reproduction steps</h4><p>{r.reproduction_steps}</p></>}
    <h4>Evidence reference</h4><p className="audit-reference">{r.evidence_reference||'Not provided'}</p>
    <h4>Limitations</h4><p>{r.limitations||'See the original CSV and audit scope above.'}</p>
   </details>
  </li>)}</ol>}
  <div className="audit-pagination"><button className="secondary-button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {last+1}</span><button className="secondary-button" disabled={page>=last} onClick={()=>setPage(p=>p+1)}>Next</button></div>
 </div>;
}
