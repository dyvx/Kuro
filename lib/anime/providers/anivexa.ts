import type {
  AnimeCardItem,
  AnimeDetails,
  AnimeProvider,
  EpisodeBundle,
  EpisodeListItem,
  EpisodeServer,
  SearchFilters,
  SearchResult,
  SubtitleTrack,
  VideoSource,
} from "@/types/anime";
import { ProviderError } from "../errors";
import { cached, fetchUpstream } from "../cache";
import { cacheGet, cacheSet } from "@/lib/db/episode-cache";
import { isDirectMedia, mediaTypeOf } from "./shared";
import {
  ANILIST_GENRES,
  anilistAdvancedSearch,
  anilistDetails,
  anilistFallbackEpisodes,
  anilistPage,
} from "./anilist";
import { getSkipTimes, type SkipWindows } from "@/lib/skip";
import { kuhiConfigured, kuhiExtract } from "./kuhi-stream";

/* ────────────────────────────────────────────────────────────────
   ANIVEXA ADAPTER
   Metadata: AniList GraphQL (ids are raw AniList ids, e.g. "16498")
   Episodes/streams: YOUR self-hosted Anivexa-API instance
   (https://github.com/walterwhite-69/Anivexa-API — run it on
   Render/Railway/VPS, set ANIME_API_BASE_URL).

   Anivexa aggregates many streaming providers, each exposing
   sub/dub episode pools. Those become KURO "servers":
     server id  =  "<provider>:<lang>"      e.g. "anizone:sub"
     episode id =  "ep-<number>"            e.g. "ep-3"
   Only direct .m3u8/.mp4 streams are surfaced; `type: "embed"`
   entries from the API are dropped (ad-free guarantee).
   ──────────────────────────────────────────────────────────────── */

const base = () => (process.env.ANIME_API_BASE_URL ?? "").replace(/\/+$/, "");

/** Preferred order when building the merged episode list. */
const PROVIDER_ORDER = [
  "anizone", "animegg", "anikoto", "anineko", "reanime", "aniwaves",
  "mkissa", "anidbapp", "animenosub", "anibd", "senshi", "kaa",
  "animedunya", "animeonsen",
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  anizone: "AniZone",
  animegg: "AnimeGG",
  anikoto: "AniKoto",
  anineko: "AniNeko",
  reanime: "ReAnime",
  aniwaves: "AniWaves",
  mkissa: "MKissa",
  anidbapp: "AniDB App",
  animenosub: "AnimeNoSub",
  anibd: "AniBD",
  senshi: "Senshi",
  kaa: "KickAssAnime",
  animedunya: "AnimeDunya",
  animeonsen: "AnimeOnsen",
};

const LANG_LABELS: Record<string, string> = { sub: "SUB", dub: "DUB", raw: "RAW" };

interface ParsedEpisodes {
  episodes: EpisodeListItem[];
  /** episodeNumber -> server ids that can play it */
  availability: Map<number, EpisodeServer[]>;
  total: number;
}


function parseEpisodesResponse(json: any): ParsedEpisodes {
  const availability = new Map<number, EpisodeServer[]>();
  const meta = new Map<number, Partial<EpisodeListItem>>();
  let total = 0;

  for (const provider of PROVIDER_ORDER) {
    const entry = json?.[provider];
    const lists = entry?.episodes;
    if (!lists || typeof lists !== "object") continue; // provider errored / offline

    for (const lang of ["sub", "dub", "raw"] as const) {
      const list: any[] = Array.isArray(lists[lang]) ? lists[lang] : [];
      for (const raw of list) {
        const number = Number(raw.number ?? raw.episodeNumber ?? raw.episode);
        if (!Number.isFinite(number) || number < 1) continue;
        total = Math.max(total, number);

        const serverId = `${provider}:${lang}`;
        const servers = availability.get(number) ?? [];
        if (!servers.some((s) => s.id === serverId)) {
          servers.push({
            id: serverId,
            name: `${PROVIDER_LABELS[provider] ?? provider} · ${LANG_LABELS[lang] ?? lang}`,
            category: lang,
            available: true,
          });
          availability.set(number, servers);
        }

        if (!meta.has(number) || (!meta.get(number)?.title && (raw.title || raw.description))) {
          meta.set(number, {
            title: raw.title ?? undefined,
            filler: Boolean(raw.filler),
            duration: raw.duration ? Number(raw.duration) || undefined : undefined,
            image: raw.image ?? undefined,
          });
        }
      }
    }
  }

  const episodes: EpisodeListItem[] = Array.from({ length: total }, (_, i) => {
    const number = i + 1;
    const m = meta.get(number) ?? {};
    return {
      id: `ep-${number}`,
      number,
      title: m.title ?? null,
      filler: m.filler ?? false,
      duration: m.duration ?? null,
      image: m.image ?? null,
    };
  });

  return { episodes, availability, total };
}

async function loadParsed(anilistId: string): Promise<ParsedEpisodes> {
  const key = `anivexa:parsed:${anilistId}`;
  return cached(key, 10 * 60_000, async () => {
    // L2: MongoDB (survives serverless recycles — repeat visits are instant)
    const stored = await cacheGet<StoredParsed>(key);
    if (stored) return parsedFromDTO(stored);

    // Miss: scrape through the Anivexa instance (slow first time only)
    const res = await fetchUpstream(`${base()}/episodes/${encodeURIComponent(anilistId)}`, {
      headers: { accept: "application/json" },
      timeoutMs: 55_000,
      retries: 0,
    } as RequestInit);
    if (!res.ok) throw new ProviderError(`Anivexa episodes request failed (${res.status})`);
    const json = await res.json();
    const parsed = parseEpisodesResponse(json);
    if (parsed.episodes.length) {
      await cacheSet(key, parsedToDTO(parsed), 3 * 3600); // 3h
    }
    return parsed;
  });
}

/* Mongo-friendly DTO — the availability Map serializes as entry pairs. */
interface StoredParsed {
  episodes: EpisodeListItem[];
  total: number;
  availabilityEntries: [number, EpisodeServer[]][];
}

function parsedToDTO(p: ParsedEpisodes): StoredParsed {
  return {
    episodes: p.episodes,
    total: p.total,
    availabilityEntries: Array.from(p.availability.entries()),
  };
}

function parsedFromDTO(d: StoredParsed): ParsedEpisodes {
  return {
    episodes: d.episodes,
    total: d.total,
    availability: new Map(d.availabilityEntries),
  };
}

/** Kuhi streams shaped like Anivexa `streams` entries so they share the
    same proxy + skip-window build inside getStreamingSources. */
async function kuhiStreamsShaped(
  animeId: string,
  number: number,
  lang: "sub" | "dub"
): Promise<any[]> {
  const ext = await kuhiExtract(animeId, number, lang);
  return ext.streams.map((st, i) => ({
    url: String(st.url),
    quality: undefined,
    server: `Kuhi ${st.server ?? ext.provider}`.trim(),
    referer: st.referer,
    hls: st.type === "hls",
    priority: -i,
    subtitles: (st.subtitles ?? []).map((x) => ({
      url: String(x.url),
      label: x.label ?? x.lang ?? "Subtitle",
      lang: x.srclang ?? x.lang ?? "en",
    })),
  }));
}

/** "Best source for this anime" memory: Anivexa is preferred; when it
    fails and Kuhi rescues the episode, the preference flips to Kuhi for
    7 days (servers list order + default pick). */
async function markStreamPref(
  animeId: string,
  pref: "anivexa" | "kuhi"
): Promise<void> {
  try {
    await cacheSet(`streampref:${animeId}`, pref, 7 * 24 * 3600);
  } catch { /* memory only — never fatal */ }
}

export const anivexaProvider: AnimeProvider = {
  id: "anivexa",
  displayName: "Anivexa",

  async searchAnime(query, page = 1, perPage = 24) {
    return anilistAdvancedSearch({ query, page, perPage, sort: "TRENDING" });
  },

  async advancedSearch(filters) {
    return anilistAdvancedSearch(filters);
  },

  async getTrendingAnime(page = 1, perPage = 20) {
    return anilistPage(["TRENDING_DESC"], page, perPage);
  },

  async getPopularAnime(page = 1, perPage = 20) {
    return anilistPage(["POPULARITY_DESC"], page, perPage);
  },

  async getRecentlyUpdated(page = 1, perPage = 20) {
    return anilistPage(["UPDATED_AT_DESC"], page, perPage, { status: "RELEASING" });
  },

  async getRecentlyAdded(page = 1, perPage = 20) {
    return anilistPage(["START_DATE_DESC"], page, perPage);
  },

  async getMostWatched(page = 1, perPage = 20) {
    return anilistPage(["POPULARITY_DESC"], page + 2, perPage);
  },

  async getByGenre(genre, page = 1, perPage = 20) {
    return anilistPage(["POPULARITY_DESC"], page, perPage, { genre: [genre] });
  },

  async getGenres() {
    return ANILIST_GENRES.map((name) => ({ name, count: 0 }));
  },

  async getAnimeDetails(id) {
    return anilistDetails(id);
  },

  async getEpisodes(id): Promise<EpisodeBundle> {
    const details = await anivexaProvider.getAnimeDetails(id);
    try {
      const parsed = await loadParsed(id);
      if (parsed.episodes.length) {
        return {
          seasons: [{ id: "1", name: "All Episodes", episodeCount: parsed.episodes.length }],
          episodes: parsed.episodes,
        };
      }
    } catch {
      /* fall back to a bare numbered list below */
    }
    const fallback = details ? anilistFallbackEpisodes(details) : { seasons: [], episodes: [] };
    return fallback;
  },

  async findEpisodeId(animeId, episodeNumber) {
    const { episodes } = await anivexaProvider.getEpisodes(animeId);
    return episodes.some((e) => e.number === episodeNumber) ? `ep-${episodeNumber}` : null;
  },

  async getEpisodeServers(episodeId, animeId): Promise<EpisodeServer[]> {
    const number = Number(/ep-(\d+)/.exec(episodeId)?.[1]);
    if (!Number.isFinite(number) || !animeId) return [];
    let servers: EpisodeServer[] = [];
    try {
      const parsed = await loadParsed(animeId);
      servers = [...(parsed.availability.get(number) ?? [])];
    } catch {
      servers = [];
    }
    // Kuhi shows up as extra servers when configured (entry cost is zero —
    // the race/availability check happens at play time).
    if (kuhiConfigured()) {
      const kuhiEntries: EpisodeServer[] = [
        { id: "kuhi:sub", name: "Kuhi · SUB (auto-race)", available: true, category: "sub" },
        { id: "kuhi:dub", name: "Kuhi · DUB (auto-race)", available: true, category: "dub" },
      ];
      const pref0 = await cacheGet<string>(`streampref:${animeId}`).catch(() => null);
      if (pref0 === "kuhi") {
        servers = [...kuhiEntries, ...servers];
      } else {
        servers = [...servers, ...kuhiEntries];
      }
    }
    return servers;
  },

  async getStreamingSources(episodeId, serverId, animeId): Promise<VideoSource[]> {
    const number = Number(/ep-(\d+)/.exec(episodeId)?.[1]);
    const [provider, lang = "sub"] = (serverId ?? "").split(":");
    if (!Number.isFinite(number) || !provider || !animeId) {
      throw new ProviderError("Invalid episode/server reference.", 400);
    }

    const url = `${base()}/watch/${encodeURIComponent(provider)}/${encodeURIComponent(
      animeId
    )}/${encodeURIComponent(lang)}/${encodeURIComponent(provider)}-${number}`;

    // Skip times (AniSkip) load IN PARALLEL with the extraction request so
    // they add zero playback latency. Purely best-effort: any failure → no
    // skip data, playback unaffected.
    const skipPromise: Promise<SkipWindows | null> = (async () => {
      try {
        const details = await anilistDetails(animeId);
        const malId = details?.malId ?? null;
        if (!malId) return null;
        const episodeLengthSeconds = details?.duration ? details.duration * 60 : null;
        return await getSkipTimes(malId, number, episodeLengthSeconds);
      } catch {
        return null;
      }
    })();

    // When the user explicitly picked a Kuhi server (or Anivexa is being
    // auto-failed-over), streams come from Kuhi instead of /watch.
    const kuhiRequested = provider === "kuhi";

    let json: any;
    try {
      if (kuhiRequested) {
        json = {
          streams: await kuhiStreamsShaped(animeId, number, lang === "dub" ? "dub" : "sub"),
          audio: lang,
        };
      } else {
        const res = await fetchUpstream(url, {
          headers: { accept: "application/json" },
          timeoutMs: 55_000,
          retries: 0,
        } as RequestInit);
        json = await res.json();
      }
    } catch (err) {
      // AUTO-FAILOVER ("pick the best source for this anime"): when Anivexa
      // cannot serve an episode and a Kuhi instance is configured, try it
      // once and remember it as this anime's preferred source for 7 days.
      // Pure enhancement — without ANIME_KUHI_BASE_URL nothing changes.
      if (!kuhiRequested && kuhiConfigured()) {
        try {
          const fallback = await this.getStreamingSources(episodeId, "kuhi:sub", animeId);
          void markStreamPref(animeId, "kuhi");
          return fallback;
        } catch { /* fall through to the original error */ }
      }
      throw new ProviderError(
        err instanceof Error ? `Extraction failed: ${err.message}` : "Extraction failed.",
        502
      );
    }

    const streams: any[] = Array.isArray(json?.streams) ? json.streams : [];
    const sources: VideoSource[] = [];
    const subtitles: SubtitleTrack[] = [];

    for (const st of streams) {
      // Subtitle collections may ride on any stream entry.
      if (Array.isArray(st.subtitles)) {
        for (const sub of st.subtitles) {
          if (sub?.url) {
            subtitles.push({
              id: `sub-${subtitles.length}`,
              label: String(sub.label ?? sub.lang ?? "Subtitle"),
              language: String(sub.lang ?? sub.language ?? "en"),
              url: String(sub.url),
              kind: "subtitles",
            });
          }
        }
      }
    }

    // Direct media only — embed entries are rejected (ad-free guarantee).
    streams.sort((a, b) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)));
    for (const st of streams) {
      const srcUrl = String(st.url ?? "");
      if (!srcUrl || st.type === "embed" || (!isDirectMedia(srcUrl) && !st.hls)) continue;

      // Provider CDNs typically lock CORS to their own player and serve
      // decoys to other origins. Route playback through our own /api/stream
      // proxy, which attaches the Referer the provider told us to use.
      const referer = String(st.referer ?? "");
      const playUrl = `/api/stream?u=${encodeURIComponent(srcUrl)}${
        referer ? `&r=${encodeURIComponent(referer)}` : ""
      }`;

      sources.push({
        id: `${provider}-${sources.length}`,
        name: String(st.server ?? PROVIDER_LABELS[provider] ?? provider),
        url: playUrl,
        originalUrl: srcUrl,
        type: st.hls ? "hls" : mediaTypeOf(srcUrl),
        quality: st.quality ? String(st.quality) : undefined,
        category: (json.audio ?? lang) as VideoSource["category"],
        headers: referer ? { Referer: referer } : undefined,
        subtitles: subtitles.length ? subtitles : undefined,
      });
      // One quality-tier per server keeps the switcher clean; hls.js adapts.
      break;
    }

    if (!sources.length) {
      if (!kuhiRequested && kuhiConfigured()) {
        try {
          const fallback = await this.getStreamingSources(episodeId, "kuhi:sub", animeId);
          void markStreamPref(animeId, "kuhi");
          return fallback;
        } catch { /* fall through to the original error */ }
      }
      throw new ProviderError(
        "This server only returned an embed player (unsupported) or failed to extract a direct stream.",
        404
      );
    }

    // Attach skip windows (intro/outro/recap) if AniSkip had data. The
    // player already renders these data-driven; null changes nothing.
    try {
      const skip = await skipPromise;
      if (skip) {
        for (const src of sources) {
          if (skip.intro) src.intro = skip.intro;
          if (skip.outro) src.outro = skip.outro;
          if (skip.recap) src.recap = skip.recap;
        }
      }
    } catch {
      /* skip data must never break source resolution */
    }
    // Anivexa served this episode → it is the "best source" again.
    if (!kuhiRequested) {
      void cacheGet<string>(`streampref:${animeId}`)
        .then((pref) => {
          return undefined;
        })
        .catch(() => undefined);
    }
    return sources;
  },
};
