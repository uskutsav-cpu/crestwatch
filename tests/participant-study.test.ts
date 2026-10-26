import { describe, it, expect } from 'vitest';
import { assignedTask, stopAttempt, validParticipantAnswer, publicSession, type ParticipantSession } from '@/lib/participant-study';
describe('Self-guided participant study',()=>{
 it.each(['crestwatch','official'] as const)('counterbalances all six tasks for %s first',order=>{
  const tasks=Array.from({length:6},(_,i)=>assignedTask(order,i)!);
  expect(tasks.slice(0,3).every(t=>t.condition===order)).toBe(true);
  expect(tasks.slice(3).every(t=>t.condition!==order)).toBe(true);
  expect(tasks.slice(0,3).map(t=>t.id)).toEqual(tasks.slice(3).map(t=>t.id));
  expect(new Set(tasks.map(t=>t.condition+':'+t.id)).size).toBe(6);
  for(const t of tasks)expect(t).not.toHaveProperty('check');
 });
 it('rejects out-of-range steps',()=>{for(const step of [-1,6,1.5,NaN])expect(assignedTask('official',step)).toBeNull();});
 it('caps delayed tab returns at two minutes and records timeout',()=>{
  expect(stopAttempt(1000,200000,'ready')).toEqual({stoppedAt:121000,outcome:'time_limit',lookupMs:120000});
  expect(stopAttempt(1000,1500,'technical_problem')).toEqual({stoppedAt:1500,outcome:'technical_problem',lookupMs:500});
  expect(stopAttempt(1000,999,'ready').lookupMs).toBe(0);
 });
 it('keeps unfinished answers while requiring help reporting and bounded text',()=>{
  expect(validParticipantAnswer('','none','skipped')).toBe(true);
  expect(validParticipantAnswer('','none','ready')).toBe(false);
  expect(validParticipantAnswer('  ','none','ready')).toBe(false);
  expect(validParticipantAnswer('Test answer','ai','ready')).toBe(true);
  expect(validParticipantAnswer('a'.repeat(1501),'none','technical_problem')).toBe(false);
  expect(validParticipantAnswer('Test answer','made-up','ready')).toBe(false);
 });
 it('projects only the participant session without private fields',()=>{
  const s={id:'qa',condition_order:'official',created_at:1,study_version:'v1',familiarity:'none',device:'phone',next_index:6,current_started_at:null,current_stopped_at:null,current_outcome:null,finished_at:10,token_hash:'SECRET'} as ParticipantSession;
  const view=publicSession(s);
  expect(view.finished).toBe(true);expect(view.task).toBeNull();
  expect(JSON.stringify(view)).not.toContain('SECRET');expect(view).not.toHaveProperty('token_hash');
 });
});
