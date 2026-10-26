import {describe,it,expect} from 'vitest';
import {upstreamScope,withUpstreamScope} from '@/lib/upstream-scope';
describe('Worker I/O request isolation',()=>{
 it('keeps limiter state and promise waiters inside their originating request',async()=>{
  const seen=await Promise.all([withUpstreamScope(async()=>{const a=upstreamScope();a.inFlight=7;await Promise.resolve();return upstreamScope()}),withUpstreamScope(async()=>{const b=upstreamScope();b.inFlight=2;await Promise.resolve();return upstreamScope()})]);
  expect(seen[0]).not.toBe(seen[1]);expect(seen[0].inFlight).toBe(7);expect(seen[1].inFlight).toBe(2);expect(seen[0].waiters).not.toBe(seen[1].waiters);
 });
});
