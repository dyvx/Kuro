import { ProviderError } from "../errors";
import { cached, fetchUpstream } from "../cache";
import { isDirectMedia, mediaTypeOf } from "./shared";

/* ────────────────────────────────────────────────────────────────
   CONSUMET STREAM SOURCE (streaming-only)

   Consumet is an ADDITIONAL stream source next to Anivexa — it is
   never used for metadata (AniList stays authoritative) and never a
   playback dependency. Configure via ANIME_CONSUMET_BASE_URL, e.g. a
   self-hosted riimuru/consumet-api Docker instance on Render.

   AniList-id native: /info/{anilistId} internally maps the AniList
   entry to its streaming-provider episodes, /watch/{episodeId}
   returns direct m3u8/mp4 sources. Works with both Consumet layouts:
   older images mount /anime/anilist/*, newer forks /meta/anilist/*.
   ──────────────────────────────────────────────────────────────── */

const BASE = (process.env.ANIME_CONSUMET_BASE_URL ?? "").replace(/\/+$/, "");

/** Which mount the instance answered on ("anime" | "meta"), remembered per process. */
let layout: "anime" | "meta" | null = null;

export function consumetConfigured(): boolean {
  return BASE.length > 0;
}

function prefixed(path: string): Record<"anime" | "meta", string> {
  return {
    anime: `${BASE}/anime/anilist${path}`,
    meta: `${BASE}/meta/anilist${path}`,
  };
}

/** GET a /anime/anilist path, retrying once on the other mount layout. */
async function anilistPathGet(path: string, timeoutMs: number): Promise<any> {
  const urls = prefixed(path);
  const order = layout === "meta" ? (["meta", "anime"] as const) : (["anime", "meta"] as const);
  let lastStatus = 0;
  for (const l of order) {
    const res = await fetchUpstream(urls[l], {
      headers: { accept: "application/json" },
      timeoutMs,
      retries: 0,
    } as RequestInit);
    if (res.ok) {
      layout = l;
      return res.json();
    }
    lastStatus = res.status;
    // Wrong mount layouts answer 404; anything else is a real failure.
    if (res.status !== 404) break;
  }
  throw new ProviderError(`Consumet request failed (${lastStatus}).`, 502);
}

export interface ConsumetEpisodeInfo {
  /** Provider episode id usable at /watch/{episodeId}, or null when absent. */
  episodeId: string | null;
  /** True when the instance definitively reports this episode exists. */
  exists: boolean;
}

/** Episode-list lookup (6h cached — Consumet re-searches its provider per call). */
export async function consumetEpisode(
  anilistId: string,
  episodeNumber: number,
  lang: "sub" | "dub" = "sub"
): Promise<ConsumetEpisodeInfo | null> {
  if (!consumetConfigured() || !Number.isFinite(Number(anilistId))) return null;
  const info = await cached(`consumet:info:${anilistId}:${lang}`, 6 * 3600_000, async () => {
    const dub = lang === "dub" ? "?dub=true" : "";
    const json = await anilistPathGet(`/info/${encodeURIComponent(anilistId)}${dub}`, 20_000);
    const eps: any[] = Array.isArray(json?.episodes) ? json.episodes : [];
    return eps
      .map((e) => ({ id: String(e?.id ?? ""), number: Number(e?.number ?? 0) }))
      .filter((e) => e.id && Number.isFinite(e.number) && e.number > 0);
  });
  const hit = info.find((e) => e.number === episodeNumber);
  return { episodeId: hit?.id ?? null, exists: Boolean(hit) };
}

export interface ConsumetStream {
  url: string;
  quality?: string;
  /** "hls" | "mp4" — derived from isM3U8 or the URL shape. */
  type: "hls" | "mp4";
  referer?: string;
}

/** Direct-stream extraction for one provider episode id. */
export async function consumetSources(episodeId: string): Promise<ConsumetStream[]> {
  const json = await anilistPathGet(`/watch/${encodeURIComponent(episodeId)}`, 30_000);
  const headers =
    json?.headers && typeof json.headers === "object" ? (json.headers as Record<string, string>) : undefined;
  const referer = headers?.Referer ?? headers?.referer ?? undefined;
  const out: ConsumetStream[] = [];
  for (const s of Array.isArray(json?.sources) ? json.sources : []) {
    const url = String(s?.url ?? s?.file ?? "");
    if (!url || (!isDirectMedia(url) && !s?.isM3U8)) continue;
    out.push({
      url,
      quality: s?.quality ? String(s.quality) : undefined,
      type: s?.isM3U8 ? "hls" : mediaTypeOf(url) === "hls" ? "hls" : "mp4",
      referer,
    });
    // Lowest-effort: one good adaptive source is all the player needs.
    if (out.length >= 3) break;
  }
  if (!out.length) {
    throw new ProviderError("Consumet returned no direct stream URLs.", 404);
  }
  return out;
}

/** True when the configured instance has this anime episode at all. */
export async function consumetHasEpisode(
  anilistId: string,
  episodeNumber: number,
  lang: "sub" | "dub" = "sub"
): Promise<boolean> {
  const info = await consumetEpisode(anilistId, episodeNumber, lang);
  return Boolean(info?.exists);
}
