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
): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  if (store.size > 5_000) {
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
  }
  return value;
}

/** Test hook. */
export function clearCache(): void {
  store.clear();
}
