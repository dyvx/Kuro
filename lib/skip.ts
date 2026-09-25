import { cacheGet, cacheSet } from "@/lib/db/episode-cache";

/* ────────────────────────────────────────────────────────────────
   ANISKIP CLIENT — isolated enhancement layer.

   Fetches community skip times (op / ed / recap) and converts them
   to KURO's TimeWindow format. Strictly best-effort:

   • any failure (404, timeout, malformed body, missing ids) → null
   • an AniSkip outage can never affect playback
   • results are cached: in-memory L1 (24h) + Mongo provider_cache
     L2 (`aniskip:{malId}:{episode}` — 7d for hits, 24h for misses)
   ──────────────────────────────────────────────────────────────── */

import type { TimeWindow } from "@/types/anime";

export interface SkipWindows {
  intro?: TimeWindow;
  outro?: TimeWindow;
  recap?: TimeWindow;
}

const BASE_URL = (process.env.ANISKIP_BASE_URL ?? "https://api.aniskip.com").replace(/\/+$/, "");
const FETCH_TIMEOUT_MS = 3_000;
const L1_TTL_MS = 24 * 3600_000;
const L2_HIT_TTL_S = 7 * 24 * 3600;
const L2_MISS_TTL_S = 24 * 3600;
const L1_MAX = 500;

/* Raw AniSkip v2 response types (strict). */
interface AniSkipInterval {
  startTime: number;
  endTime: number;
}
interface AniSkipResult {
  interval: AniSkipInterval;
  skipType: string;
  episodeLength?: number;
}
interface AniSkipResponse {
  found?: boolean;
  results?: AniSkipResult[];
}

const l1 = new Map<string, { at: number; value: SkipWindows }>();

/** undefined = miss; otherwise the cached windows (possibly empty). */
function l1Get(key: string): SkipWindows | undefined {
  const hit = l1.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > L1_TTL_MS) {
    l1.delete(key);
    return undefined;
  }
  return hit.value;
}

function l1Set(key: string, value: SkipWindows) {
  if (l1.size >= L1_MAX) {
    const oldest = Array.from(l1.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) l1.delete(oldest[0]);
  }
  l1.set(key, { at: Date.now(), value });
}

function hasWindows(w: SkipWindows): boolean {
  return Boolean(w.intro || w.outro || w.recap);
}

function toWindow(r: AniSkipResult): TimeWindow | null {
  const start = Number(r.interval?.startTime);
  const end = Number(r.interval?.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < 0) return null;
  return { start, end };
}

/** op / mixed-op → intro · ed / mixed-ed → outro · recap → recap */
function convert(results: AniSkipResult[]): SkipWindows {
  const out: SkipWindows = {};
  for (const r of results) {
    if (!r || typeof r.skipType !== "string") continue;
    const type = r.skipType.toLowerCase();
    const win = toWindow(r);
    if (!win) continue;
    if ((type === "op" || type === "mixed-op") && !out.intro) out.intro = win;
    else if ((type === "ed" || type === "mixed-ed") && !out.outro) out.outro = win;
    else if (type === "recap" && !out.recap) out.recap = win;
  }
  return out;
}

/**
 * Skip windows for a MAL id + episode number.
 * Returns null when there is no data (unknown id/episode, provider
 * failure) — callers must treat null as "play on without skip data".
 */
export async function getSkipTimes(
  malId: number,
  episodeNumber: number,
  episodeLengthSeconds?: number | null,
): Promise<SkipWindows | null> {
  if (!Number.isFinite(malId) || malId <= 0 || !Number.isFinite(episodeNumber) || episodeNumber <= 0) {
    return null;
  }
  const key = `aniskip:${malId}:${episodeNumber}`;

  const local = l1Get(key);
  if (local !== undefined) return hasWindows(local) ? local : null;

  const stored = await cacheGet<SkipWindows>(key).catch(() => null);
  const storedValue = stored && typeof stored === "object" ? stored : null;
  if (storedValue) {
    l1Set(key, storedValue);
    return hasWindows(storedValue) ? storedValue : null;
  }

  let windows: SkipWindows;
  try {
    // append (not set): AniSkip expects repeated `types` parameters.
    const params = new URLSearchParams();
    params.append("types", "op");
    params.append("types", "ed");
    params.append("types", "recap");
    if (episodeLengthSeconds && episodeLengthSeconds > 0) {
      params.set("episodeLength", String(Math.floor(episodeLengthSeconds)));
    }
    const res = await fetch(
      `${BASE_URL}/v2/skip-times/${Math.floor(malId)}/${Math.floor(episodeNumber)}?${params.toString()}`,
      {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      // 404 = no skip data for this episode; other statuses equally non-fatal.
      windows = {};
    } else {
      const json = (await res.json().catch(() => null)) as AniSkipResponse | null;
      if (!json || json.found === false || !Array.isArray(json.results)) {
        windows = {};
      } else {
        windows = convert(json.results);
      }
    }
  } catch (e) {
    // Timeout / network / shutdown — never block, never throw upward.
    return null;
  }

  l1Set(key, windows);
  await cacheSet(key, windows, hasWindows(windows) ? L2_HIT_TTL_S : L2_MISS_TTL_S).catch(() => {});
  return hasWindows(windows) ? windows : null;
}
