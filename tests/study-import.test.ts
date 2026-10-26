import { describe,it,expect } from 'vitest';
import {parseStudyCsv} from '@/lib/study-import';
import {studyCsv,type StudyResult} from '@/lib/study';
const example:StudyResult={id:'synthetic',participant:'QA_ONLY',condition:'official',task:'threshold',elapsedMs:120000,outcome:'incomplete',understanding:'incorrect',note:'Synthetic note, "quoted"\nsecond line',recordedAt:'2026-10-25T20:00:00Z'};
describe('Local observation import',()=>{
 it('preserves unsuccessful attempts, quoted commas, quotes and newlines',()=>{expect(parseStudyCsv(studyCsv([example]),'import')[0]).toEqual({...example,id:'import-0'});});
 it('does not create observations from a header-only template',()=>{expect(parseStudyCsv(studyCsv([]),'import')).toEqual([]);});
 it('rejects malformed quoting and invalid numeric fields atomically',()=>{
  expect(()=>parseStudyCsv(studyCsv([example])+'"unclosed','import')).toThrow();
  expect(()=>parseStudyCsv(studyCsv([example]).replace('120,','NaN,'),'import')).toThrow();
  expect(()=>parseStudyCsv(studyCsv([example]).replace('120,',', '),'import')).toThrow();
 });
 it('keeps repeated observations so the report can flag ambiguity instead of picking a winner',()=>{expect(parseStudyCsv(studyCsv([example,example]),'import')).toHaveLength(2);});
 it('rejects missing headers, private identifier formats and over-limit files',()=>{
  expect(()=>parseStudyCsv('x,y\n1,2','import')).toThrow();
  expect(()=>parseStudyCsv(studyCsv([example]).replace('QA_ONLY','name@example.com'),'import')).toThrow();
  expect(()=>parseStudyCsv('a'.repeat(1000001),'import')).toThrow();
 });
});
