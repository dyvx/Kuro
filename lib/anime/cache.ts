/* Tiny in-memory TTL cache for server-side provider calls.
   Survives dev-server HMR via globalThis, keeps API traffic low. */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const globalCache = globalThis as unknown as {
  __kuroCache?: Map<string, CacheEntry<unknown>>;
};

const cache: Map<string, CacheEntry<unknown>> =
  globalCache.__kuroCache ?? new Map();
globalCache.__kuroCache = cache;

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await loader();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  // Opportunistic cleanup to keep the map bounded.
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of Array.from(cache)) if (v.expires < now) cache.delete(k);
  }
  return value;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/* fetch() wrapper with timeout + one retry for flaky upstreams. */
export async function fetchUpstream(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { timeoutMs = 12_000, retries = 1, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...rest, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}
