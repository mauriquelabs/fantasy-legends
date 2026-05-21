interface CacheEntry<T> { data: T; ts: number }
const cache = new Map<string, CacheEntry<unknown>>();

export function fromCache<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
  return null;
}

export function toCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export function clearByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
