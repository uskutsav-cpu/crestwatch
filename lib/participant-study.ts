import { STUDY_TASKS } from './study';
export const PARTICIPANT_VERSION = 'self-guided-2026-10-v2';
export const TASK_LIMIT_MS = 120000;
export const ATTEMPT_OUTCOMES = ['ready','could_not_complete','technical_problem','skipped','time_limit'] as const;
export type AttemptOutcome = typeof ATTEMPT_OUTCOMES[number];
export const HELP_OPTIONS = ['none','person','ai','other','not_sure'] as const;
export function assignedTask(order: 'crestwatch'|'official', step: number) {
 if (!Number.isInteger(step) || step < 0 || step >= 6) return null;
 const condition = step < 3 ? order : order === 'crestwatch' ? 'official' : 'crestwatch';
 const task = STUDY_TASKS[step % 3];
 return {id:task.id,title:task.title,prompt:task.prompt,condition,href:condition==='crestwatch'?task.app:'https://water.noaa.gov/gauges/VCKM6'};
}
export function stopAttempt(startedAt: number, now: number, outcome: AttemptOutcome) {
 const elapsed = Math.max(0,now-startedAt);
 return { stoppedAt: startedAt + Math.min(TASK_LIMIT_MS,elapsed), outcome: elapsed >= TASK_LIMIT_MS ? 'time_limit' as const : outcome, lookupMs: Math.min(TASK_LIMIT_MS,elapsed) };
}
export function validParticipantAnswer(answer: unknown, help: unknown, outcome: AttemptOutcome) {
 return typeof answer==='string' && answer.length<=1500 && (outcome!=='ready'||answer.trim().length>=3) && HELP_OPTIONS.includes(help as typeof HELP_OPTIONS[number]);
}
export interface ParticipantSession {
 id:string; condition_order:'crestwatch'|'official'; created_at:number; study_version:string; familiarity:string; device:string;
 next_index:number; current_started_at:number|null; current_stopped_at:number|null; current_outcome:AttemptOutcome|null; finished_at:number|null;
}
export function publicSession(s:ParticipantSession) {
 return {id:s.id,order:s.condition_order,nextIndex:s.next_index,startedAt:s.current_started_at,stoppedAt:s.current_stopped_at,outcome:s.current_outcome,finished:s.finished_at!==null,task:assignedTask(s.condition_order,s.next_index),version:s.study_version};
}
