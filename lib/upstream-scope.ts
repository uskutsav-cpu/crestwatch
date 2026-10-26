import { AsyncLocalStorage } from "node:async_hooks";
export interface UpstreamScope {
  inFlight: number;
  waiters: Array<() => void>;
}
const scopes = new AsyncLocalStorage<UpstreamScope>();
const fallback: UpstreamScope = { inFlight: 0, waiters: [] };
export function upstreamScope(): UpstreamScope {
  return scopes.getStore() ?? fallback;
}
/** Worker requests cannot resolve each other's I/O promises. Limit each request independently. */
export function withUpstreamScope<T>(fn: () => T): T {
  return scopes.run({ inFlight: 0, waiters: [] }, fn);
}
