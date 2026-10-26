import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import summary from '@/docs/audit/summary.json';
import { filterAuditChecks, readableAuditValue, type AuditCheck } from '@/lib/automated-audit';
import { timeLabel } from '@/lib/river-stations';
const rows=JSON.parse(readFileSync('public/evidence/automated-audit-index.json','utf8')) as AuditCheck[];
describe('Preserved automated audit evidence',()=>{
 it('keeps the original CSV bytes and reconciles the published breakdown',()=>{
  const csv=readFileSync('public/evidence/CrestWatch_NOAA_1000_Automated_Checks.csv');
  expect(createHash('sha256').update(csv).digest('hex')).toBe(summary.sha256);
  expect(rows).toHaveLength(summary.total);expect(new Set(rows.map(r=>r.check_id)).size).toBe(summary.total);
  expect(rows.filter(r=>r.status==='PASS')).toHaveLength(summary.statuses.PASS);
  expect(rows.filter(r=>r.category==='impact_slider')).toHaveLength(summary.slider);
  expect(summary.slider+summary.other).toBe(summary.total);
  expect(summary.humanParticipants).toBe(0);expect(summary.studySubmissions).toBe(0);
  for(const g of summary.gauges){expect(rows.filter(r=>r.gauge_id===g.id)).toHaveLength(g.total);expect(rows.filter(r=>r.gauge_id===g.id&&r.category==='impact_slider')).toHaveLength(g.slider);}
 });
 it('preserves the limited PASS and date finding instead of rewriting the audit',()=>{
  const finding=rows.find(r=>r.check_id==='YZOM6-003')!;
  expect(finding.status).toBe('PASS');expect(finding.severity).toBe('LOW');expect(finding.notes).toContain('Missing calendar date');
 });
 it('finds baseline and slider checks with combined filters and empty results',()=>{
  expect(filterAuditChecks(rows,'VCKM6','slider','')).toHaveLength(240);
  expect(filterAuditChecks(rows,'','other','')).toHaveLength(40);
  expect(filterAuditChecks(rows,'YZOM6','other','  yzom6-003  ')).toHaveLength(1);
  expect(filterAuditChecks(rows,'JACM6','slider','YZOM6-003')).toHaveLength(0);
 });
 it('renders structured results readably without losing supplied text',()=>{
  expect(readableAuditValue('{"count":0}')).toContain('"count": 0');expect(readableAuditValue('Not verified')).toBe('Not verified');expect(readableAuditValue(undefined)).toContain('Not provided');
 });
});
describe('Complete Central timestamps for river data',()=>{
 it('shows the date, year, time and timezone, including Central day and year rollover',()=>{
  const label=timeLabel('2027-01-01T01:30:00Z');
  expect(label).toContain('Dec 31, 2026');expect(label).toContain('7:30 PM CST');
  expect(timeLabel('2026-10-26T02:00:00Z')).toContain('Oct 25, 2026');
 });
 it('distinguishes the repeated hour at the autumn daylight-saving boundary',()=>{
  expect(timeLabel('2026-11-01T06:30:00Z')).toContain('1:30 AM CDT');
  expect(timeLabel('2026-11-01T07:30:00Z')).toContain('1:30 AM CST');
 });
 it('does not invent a date when a timestamp is missing or invalid',()=>{
  for(const value of [null,undefined,'','invalid'])expect(timeLabel(value)).toBe('Time unavailable');
 });
});
