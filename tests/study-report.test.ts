import { describe, expect, it } from 'vitest';
import { summarizeStudy, studyReport } from '@/lib/study-report';
import type { StudyResult } from '@/lib/study';
// Synthetic fixtures only; never published as participant evidence.
const r = (changes: Partial<StudyResult> = {}): StudyResult => ({ id: 'fixture', participant: 'TEST01', task: 'observation', condition: 'crestwatch', elapsedMs: 20000, outcome: 'unaided', understanding: 'correct', note: '', recordedAt: '2026-10-25T18:00:00Z', ...changes });
describe('Descriptive study reporting', () => {
  it('never manufactures evidence from an empty study', () => {
    expect(studyReport([])).toContain('NO STUDY EVIDENCE');
    expect(summarizeStudy([]).participants).toBe(0);
  });
  it('excludes assisted, incorrect and unassessed attempts from successful time medians', () => {
    const s = summarizeStudy([r(), r({participant:'TEST02', elapsedMs:1000, outcome:'assisted'}), r({participant:'TEST03', elapsedMs:500, understanding:'incorrect'}), r({participant:'TEST04', elapsedMs:500, understanding:'not_assessed'})]);
    expect(s.tasks[0].conditions[0]).toMatchObject({total:4,unaidedCorrect:1,assisted:1,notAssessed:1,medianSeconds:20});
  });
  it('excludes all ambiguous duplicate attempts rather than selecting the fastest', () => {
    const s = summarizeStudy([r(),r({id:'again',elapsedMs:1000})]);
    expect(s.duplicateGroups).toBe(1);
    expect(s.included).toBe(0);
    expect(s.tasks[0].conditions[0].medianSeconds).toBeNull();
  });
  it('pairs only the same participant and task with unaided correct explanations in both conditions', () => {
    const s = summarizeStudy([r(),r({condition:'official',elapsedMs:30000}),r({participant:'TEST02',condition:'official',elapsedMs:60000}),r({task:'forecast',condition:'official'})]);
    expect(s.tasks[0].pairedCount).toBe(1);
    expect(s.tasks[0].pairedMedianDifference).toBe(-10);
    expect(s.tasks[1].pairedCount).toBe(0);
  });
  it('includes incomplete outcomes in denominators and labels missing timing evidence', () => {
    const s = summarizeStudy([r({outcome:'incomplete',understanding:'not_assessed'})]);
    expect(s.tasks[0].conditions[0]).toMatchObject({total:1,incomplete:1,unaidedCorrect:0,medianSeconds:null});
    expect(studyReport([r({outcome:'incomplete'})])).toContain('Not available');
  });
});

describe('Paired outcomes preserve failures and contrary evidence',()=>{
 it('counts both, CrestWatch only, official only and neither on the same task denominator',()=>{
  const rows=[
   r({participant:'BOTH'}),r({participant:'BOTH',condition:'official'}),
   r({participant:'CREST'}),r({participant:'CREST',condition:'official',outcome:'incomplete',understanding:'not_assessed'}),
   r({participant:'OFFICIAL',outcome:'assisted',understanding:'partial'}),r({participant:'OFFICIAL',condition:'official'}),
   r({participant:'NEITHER',understanding:'incorrect'}),r({participant:'NEITHER',condition:'official',outcome:'incomplete',understanding:'incorrect'}),
  ];
  expect(summarizeStudy(rows).tasks[0].matched).toEqual({total:4,both:1,crestOnly:1,officialOnly:1,neither:1,unassessedPairs:1,unpaired:0});
 });
 it('does not turn missing records or duplicate attempts into paired wins',()=>{
  const s=summarizeStudy([r(),r({id:'duplicate'}),r({condition:'official'})]);
  expect(s.tasks[0].matched.total).toBe(0);
  expect(s.tasks[0].matched.unpaired).toBe(1);
  expect(s.coverage[0].missing).toContain('crestwatch/observation');
 });
 it('shows official-only successes and incorrect explanations in the report',()=>{
  const report=studyReport([r({understanding:'incorrect'}),r({condition:'official'})]);
  expect(report).toContain('| Find the latest observation | 1 | 0 | 0 | 1 | 0 | 0 | 0 |');
  expect(report).toContain('Partial/incorrect');
 });
});
