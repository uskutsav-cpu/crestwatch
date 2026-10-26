import { describe, it, expect } from 'vitest';
import { chartRange } from '@/lib/chart-range';
import { historyPoints, replayEventId } from '@/lib/history-records';
describe('Chart scale context',()=>{
 it('includes flood stage in full context and preserves actual samples in detail',()=>{
  const full=chartRange([12,14],43,null,false), detail=chartRange([12,14],43,null,true);
  expect(full.hi).toBeGreaterThan(43);expect(detail.hi).toBeLessThan(43);
  expect(detail.lo).toBeLessThan(12);expect(detail.hi).toBeGreaterThan(14);
 });
 it('keeps an explored reference visible in either mode',()=>{
  for(const focus of [false,true]) expect(chartRange([12,14],43,55,focus).hi).toBeGreaterThan(55);
 });
 it('handles zero, negative and constant readings without a collapsed range',()=>{
  for(const values of [[0,0],[-3,-3]]) { const r=chartRange(values,null,null,true);expect(r.hi).toBeGreaterThan(r.lo);expect(r.lo).toBeLessThanOrEqual(values[0]); }
 });
 it('opens supported historical deep links and rejects unknown records',()=>{
  expect(replayEventId('pearl2022')).toBe('pearl2022');expect(replayEventId('bad')).toBe('pearl2020');
  expect(historyPoints('pearl2020')).toHaveLength(33);
  expect(historyPoints('pearl2022').length).toBeGreaterThan(1);
 });
});
