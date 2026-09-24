import type {
  AnimeCardItem,
  AnimeDetails,
  AnimeProvider,
  EpisodeBundle,
  EpisodeListItem,
  EpisodeServer,
  SearchFilters,
  SearchResult,
  VideoSource,
} from "@/types/anime";
import { ProviderError, stripHtml } from "../errors";
import { cached, fetchUpstream } from "../cache";
import { isDirectMedia, looksLikeEmbed, mapRating, mediaTypeOf } from "./shared";

/* ────────────────────────────────────────────────────────────────
   ANIFY ADAPTER (experimental)
   Anify aggregates metadata + sources. Mapping is defensive because
   field shapes vary between Anify deployments. Configure
   ANIME_API_BASE_URL=https://api.anify.it (+ optional ANIME_API_KEY).
   ──────────────────────────────────────────────────────────────── */

const base = (process.env.ANIME_API_BASE_URL ?? "https://api.anify.it").replace(/\/+$/, "");

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  if (process.env.ANIME_API_KEY) h.authorization = process.env.ANIME_API_KEY;
  return h;
}

async function anifyGet(path: string): Promise<unknown> {
  const res = await fetchUpstream(`${base}${path}`, {
    headers: headers(),
    timeoutMs: 15_000,
  } as RequestInit);
  if (!res.ok) throw new ProviderError(`Anify request failed (${res.status})`);
  return res.json();
}


function toCard(r: any): AnimeCardItem {
  const title = r.title ?? {};
  return {
    id: String(r.id),
    title: title.romaji ?? title.english ?? title.native ?? "Unknown",
    englishTitle: title.english && title.english !== title.romaji ? title.english : null,
    japaneseTitle: title.native ?? null,
    image: r.coverImage ?? r.image ?? null,
    banner: r.bannerImage ?? null,
    color: r.color ?? null,
    rating: mapRating(r.averageScore),
    year: r.year ?? r.seasonYear ?? (r.startDate ? Number(String(r.startDate).slice(0, 4)) : null),
    type: (r.format === "MOVIE" ? "Movie" : r.format === "ONA" ? "ONA" : r.format === "OVA" ? "OVA" : "TV") as AnimeCardItem["type"],
    episodes: r.episodesCount ?? r.episodes ?? null,
    genres: r.genres ?? [],
    status: (r.status ?? "FINISHED") as AnimeCardItem["status"],
  };
}

function firstList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

export const anifyProvider: AnimeProvider = {
  id: "anify",
  displayName: "Anify",

  async searchAnime(query, page = 1, perPage = 24) {
    const json = await cached(`anify:search:${query}:${page}:${perPage}`, 10 * 60_000, () =>
      anifyGet(`/search-advanced?query=${encodeURIComponent(query)}&type=anime&page=${page}&perPage=${perPage}`)
    );
    const list = firstList(json);
    const slice = list.slice(0, perPage);
    return { items: slice.map(toCard), total: list.length, page, perPage, hasNextPage: list.length > perPage };
  },

  async advancedSearch(filters) {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.genres?.length) params.set("genres", JSON.stringify(filters.genres));
    if (filters.year) params.set("year", String(filters.year));
    if (filters.sort) params.set("sort", JSON.stringify([filters.sort === "RATING" ? "SCORE_DESC" : filters.sort === "NEWEST" ? "START_DATE_DESC" : "POPULARITY_DESC"]));
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 24;
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    const json = await anifyGet(`/search-advanced?${params.toString()}`);
    const list = firstList(json);
    return {
      items: list.slice(0, perPage).map(toCard),
      total: list.length,
      page,
      perPage,
      hasNextPage: list.length > perPage,
    } satisfies SearchResult;
  },

  async getTrendingAnime(page = 1, perPage = 20) {
    const json = await cached(`anify:trending:${page}:${perPage}`, 10 * 60_000, () =>
      anifyGet(`/trending?range=7`)
    );
    const list = firstList(json).sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
    return list.slice((page - 1) * perPage, page * perPage).map(toCard);
  },

  async getPopularAnime(page = 1, perPage = 20) {
    return anifyProvider.advancedSearch({ sort: "POPULARITY", page, perPage }).then((r) => r.items);
  },

  async getRecentlyUpdated(page = 1, perPage = 20) {
    const json = await cached(`anify:recent:${page}:${perPage}`, 5 * 60_000, () =>
      anifyGet(`/recent?limit=${perPage}`)
    );
    return firstList(json).slice(0, perPage).map(toCard);
  },

  async getRecentlyAdded(page = 1, perPage = 20) {
    return anifyProvider.advancedSearch({ sort: "NEWEST", page, perPage }).then((r) => r.items);
  },

  async getMostWatched(page = 1, perPage = 20) {
    return anifyProvider.getPopularAnime(page + 1, perPage);
  },

  async getByGenre(genre, page = 1, perPage = 20) {
    return anifyProvider.advancedSearch({ genres: [genre], sort: "POPULARITY", page, perPage }).then((r) => r.items);
  },

  async getGenres() {
    return ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"].map(
      (name) => ({ name, count: 0 })
    );
  },

  async getAnimeDetails(id): Promise<AnimeDetails | null> {
    const json = await cached(`anify:info:${id}`, 60 * 60_000, () => anifyGet(`/info/${encodeURIComponent(id)}?metadata=true`));
    const r = Array.isArray(json) ? json[0] : json;
    if (!r) return null;
    const card = toCard(r);
    return {
      ...card,
      description: stripHtml(r.description),
      season: null,
      studio: Array.isArray(r.studios) && r.studios.length ? r.studios[0] : null,
      duration: null,
      popularity: null,
      totalEpisodes: r.episodesCount ?? card.episodes ?? 0,
    };
  },

  async getEpisodes(id): Promise<EpisodeBundle> {
    const json = await cached(`anify:episodes:${id}`, 15 * 60_000, () => anifyGet(`/episodes/${encodeURIComponent(id)}`));
    const raw: any[] = Array.isArray(json) ? json : firstList(json);
    const episodes: EpisodeListItem[] = raw
      .map((e, i) => ({
        id: String(e.id ?? e.episodeId ?? `${id}-${i + 1}`),
        number: Number(e.episodeNumber ?? e.number ?? i + 1),
        title: e.title ?? e.episodeTitle ?? null,
        image: e.image ?? e.thumbnail ?? null,
        filler: Boolean(e.filler ?? e.isFiller),
        recap: Boolean(e.recap),
        airDate: e.airDate ?? e.aired ?? null,
      }))
      .sort((a, b) => a.number - b.number);
    return {
      seasons: episodes.length ? [{ id: "1", name: "All Episodes", episodeCount: episodes.length }] : [],
      episodes,
    };
  },

  async findEpisodeId(animeId, episodeNumber) {
    const { episodes } = await anifyProvider.getEpisodes(animeId);
    return episodes.find((e) => e.number === episodeNumber)?.id ?? null;
  },

  async getEpisodeServers(episodeId): Promise<EpisodeServer[]> {
    try {
      const json = await anifyGet(`/sources/available?episodeId=${encodeURIComponent(episodeId)}`);
      const raw: any[] = firstList(json);
      const servers = raw
        .map((s, i) => ({
          id: String(s.providerId ?? s.id ?? `server-${i}`),
          name: String(s.providerName ?? s.name ?? `Server ${i + 1}`),
          embedOnly: looksLikeEmbed(s.url ?? s.embed),
          available: true,
        }))
        .filter((s) => !s.embedOnly);
      if (servers.length) return servers;
    } catch {
      /* generic fallback below */
    }
    return [{ id: "default", name: "Primary", available: true }];
  },

  async getStreamingSources(episodeId, serverId): Promise<VideoSource[]> {
    const params = new URLSearchParams({ episodeId });
    if (serverId) params.set("providerId", serverId);
    const json = await anifyGet(`/sources?${params.toString()}`);
    const groups: any[] = Array.isArray(json) ? json : firstList(json);
    const sources: VideoSource[] = [];
    for (const group of groups) {
      const provider = String(group.providerId ?? serverId ?? "primary");
      for (const s of group.sources ?? []) {
        const url = String(s.url ?? "");
        if (!url || !isDirectMedia(url)) continue;
        sources.push({
          id: `${provider}-${sources.length}`,
          name: String(group.providerName ?? provider),
          url,
          type: mediaTypeOf(url),
          quality: s.quality ? String(s.quality) : undefined,
          subtitles: (group.subtitles ?? []).map((st: any, i: number) => ({
            id: `sub-${i}`,
            label: String(st.label ?? st.lang ?? `Subtitle ${i + 1}`),
            language: String(st.lang ?? "en"),
            url: String(st.url),
            kind: "subtitles" as const,
          })),
        });
      }
    }
    if (!sources.length) {
      throw new ProviderError("No direct stream URLs were extractable for this server.", 404);
    }
    return sources;
  },
};
