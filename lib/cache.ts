/**
 * Tiny in-memory TTL cache for the API routes. Serverless instances each
 * get their own map — best-effort but plenty at this scale, and it keeps
 * the federal APIs from being hammered by refresh-happy visitors.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  /**
   * Return false to serve a value WITHOUT storing it. Failure results must
   * not be cached — a transient upstream blip would otherwise be pinned
   * for the whole TTL, long after the upstream recovered.
   */
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    // Promote on read: Map insertion order is our LRU order, so a key the
    // app keeps asking for must not be the first thing evicted. (Its TTL
    // is unchanged — promotion reorders, it doesn't extend freshness.)
    store.delete(key);
    store.set(key, hit);
    return hit.value as T;
  }
  const value = await fn();
  if (!shouldCache(value)) return value;
  // Same reason on write: a refreshed key would otherwise keep its
  // original, stale slot.
  store.delete(key);
  store.set(key, { value, expiresAt: now + ttlMs });
  if (store.size > 5_000) {
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
    // Hard cap even when every entry is fresh: evict least-recently-used.
    while (store.size > 5_000) {
      const lru = store.keys().next().value;
      if (lru === undefined) break;
      store.delete(lru);
    }
  }
  return value;
}

/** Test hook. */
export function clearCache(): void {
  store.clear();
}
