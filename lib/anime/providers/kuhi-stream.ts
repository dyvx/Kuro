import { ProviderError } from "../errors";
import { fetchUpstream } from "../cache";
import { isDirectMedia } from "./shared";

/* ────────────────────────────────────────────────────────────────
   KUHI STREAM SOURCE (streaming-only)

   Kuhi (github.com/aryaniiil/anime-api) is an ADDITIONAL stream
   source next to Anivexa — never used for metadata (AniList stays
   authoritative) and never a playback dependency. It races 10 native
   providers (anikoto, animegg, kaa, anibd, reanime, …) concurrently
   and returns direct HLS/MP4/DASH URLs with per-stream subtitles.

   Configure ANIME_KUHI_BASE_URL (e.g. your own Kuhi instance on
   Render). AniList-id native: GET /anime/extract/{id}?e={ep}&type=
   {sub|dub}[&provider=x]. Leave empty to disable.
   ──────────────────────────────────────────────────────────────── */

const BASE = (process.env.ANIME_KUHI_BASE_URL ?? "").replace(/\/+$/, "");

export function kuhiConfigured(): boolean {
  return BASE.length > 0;
}

export interface KuhiSubtitle {
  url: string;
  label?: string;
  lang?: string;
  srclang?: string;
}

export interface KuhiStream {
  url: string;
  type?: string;
  server?: string;
  referer?: string;
  subtitles?: KuhiSubtitle[];
}

export interface KuhiExtract {
  provider: string;
  defaultProvider?: string;
  streams: KuhiStream[];
}

/** Race-extract direct streams for an AniList episode. */
export async function kuhiExtract(
  anilistId: string,
  episodeNumber: number,
  lang: "sub" | "dub" = "sub",
  provider?: string
): Promise<KuhiExtract> {
  if (!kuhiConfigured()) {
    throw new ProviderError("Kuhi is not configured.", 400);
  }
  const params = new URLSearchParams({
    e: String(Math.max(1, Math.floor(episodeNumber))),
    type: lang === "dub" ? "dub" : "sub",
  });
  if (provider) params.set("provider", provider);
  const res = await fetchUpstream(
    `${BASE}/anime/extract/${encodeURIComponent(anilistId)}?${params.toString()}`,
    {
      headers: { accept: "application/json" },
      timeoutMs: 55_000,
      retries: 0,
    } as RequestInit
  );
  if (!res.ok) {
    throw new ProviderError(`Kuhi extract failed (${res.status}).`, res.status === 404 ? 404 : 502);
  }
  const json: any = await res.json();
  const streams: KuhiStream[] = Array.isArray(json?.streams) ? json.streams : [];
  const usable = streams.filter((s) => {
    const url = String(s?.url ?? "");
    // Direct media (m3u8/mp4) or explicitly HLS — embed-only entries are rejected.
    if (!url) return false;
    if (s?.type === "hls") return true;
    return isDirectMedia(url);
  });
  if (!usable.length) {
    throw new ProviderError("Kuhi returned no direct streams for this episode.", 404);
  }
  return {
    provider: String(json?.provider ?? "kuhi"),
    defaultProvider: json?.defaultProvider ? String(json.defaultProvider) : undefined,
    streams: usable,
  };
}
