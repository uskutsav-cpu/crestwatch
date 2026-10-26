"""Derive the public audit summary/index from the preserved, supplied CSV. No tests executed here."""
import csv,hashlib,json,collections,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'public/evidence/CrestWatch_NOAA_1000_Automated_Checks.csv'
raw=source.read_bytes()
with source.open(newline='',encoding='utf-8-sig') as f: rows=list(csv.DictReader(f))
assert len(rows)==1000 and len({r['check_id'] for r in rows})==1000
assert all(r['record_origin']=='AUTOMATED_QA' and r['human_participant_count']=='0' and r['study_submission']=='false' for r in rows)
assert all(r['status'] in ['PASS','FAIL','SKIP','ERROR'] for r in rows)
gauges=[]
for gid in ['VCKM6','GEEM6','YZOM6','JACM6']:
 group=[r for r in rows if r['gauge_id']==gid]
 captures=sorted({r['noaa_reference_captured_at_utc'] for r in group if r['noaa_reference_captured_at_utc']})
 assert len(captures)==1
 gauges.append({'id':gid,'total':len(group),'slider':sum(r['category']=='impact_slider' for r in group),'sourceCapturedAt':captures[0]})
summary={'file':source.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'total':len(rows),'statuses':dict(collections.Counter(r['status'] for r in rows)),'slider':sum(r['category']=='impact_slider' for r in rows),'other':sum(r['category']!='impact_slider' for r in rows),'gauges':gauges,'startedAt':min(r['executed_at_utc'] for r in rows),'endedAt':max(r['executed_at_utc'] for r in rows),'humanParticipants':0,'studySubmissions':0,'sourceCaptures':len(gauges),'lowSeverity':sum(r['severity']=='LOW' for r in rows)}
(root/'docs/audit/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
keys=['check_id','gauge_id','category','test_name','status','severity','finding','notes','input_value_ft','expected_result','actual_result','evidence_reference','reproduction_steps','limitations']
index=[{k:r[k] for k in keys if r[k]} for r in rows]
(root/'public/evidence/automated-audit-index.json').write_text(json.dumps(index,separators=(',',':'))+'\n')
print(json.dumps(summary,indent=2))
