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
   CONSUMET ADAPTER
   Uses the AniList provider (via your Consumet instance) for rich
   metadata and a streaming provider (gogoanime/zoro) for direct
   source extraction. Configure ANIME_API_BASE_URL + provider envs.
   ──────────────────────────────────────────────────────────────── */

const base = (process.env.ANIME_API_BASE_URL ?? "").replace(/\/+$/, "");
const STREAM_PROVIDER = process.env.CONSUMET_STREAMING_PROVIDER ?? "gogoanime";

const ANILIST_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
  "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];


function toCard(r: any): AnimeCardItem {
  const cover = r.coverImage ?? {};
  return {
    id: String(r.id),
    title: r.title?.romaji ?? r.title?.english ?? r.title?.userPreferred ?? "Unknown",
    englishTitle: r.title?.english && r.title.english !== r.title?.romaji ? r.title.english : null,
    japaneseTitle: r.title?.native ?? null,
    image: r.image ?? cover.extraLarge ?? cover.large ?? null,
    banner: r.bannerImage ?? null,
    color: r.color ?? cover.color ?? null,
    rating: mapRating(r.rating),
    year: r.releaseDate?.year ?? r.year ?? r.seasonYear ?? null,
    type: (r.type === "MOVIE" ? "Movie" : r.type === "ONA" ? "ONA" : r.type === "OVA" ? "OVA" : "TV") as AnimeCardItem["type"],
    episodes: r.episodes ?? null,
    genres: r.genres ?? [],
    status: (r.status ?? "FINISHED") as AnimeCardItem["status"],
  };
}

function pageInfoToMeta(json: any) {
  const pi = json?.pageInfo ?? {};
  return {
    total: pi.total ?? json?.results?.length ?? 0,
    hasNextPage: Boolean(pi.hasNextPage),
  };
}

async function anilistGet(path: string): Promise<any> {
  const res = await fetchUpstream(`${base}/anime/anilist${path}`, {
    headers: { accept: "application/json" },
    next: undefined,
  } as RequestInit);
  if (!res.ok) {
    throw new ProviderError(`Consumet metadata request failed (${res.status})`);
  }
  return res.json();
}

async function streamGet(path: string): Promise<any> {
  const res = await fetchUpstream(`${base}/anime/${STREAM_PROVIDER}${path}`, {
    headers: { accept: "application/json" },
  } as RequestInit);
  if (!res.ok) {
    throw new ProviderError(`Consumet stream request failed (${res.status})`);
  }
  return res.json();
}

function sortToAniList(sort: SearchFilters["sort"]): string {
  switch (sort) {
    case "POPULARITY":
      return "POPULARITY_DESC";
    case "RATING":
      return "SCORE_DESC";
    case "NEWEST":
      return "START_DATE_DESC";
    case "TITLE":
      return "TITLE_ROMAJI";
    default:
      return "TRENDING_DESC";
  }
}

export const consumetProvider: AnimeProvider = {
  id: "consumet",
  displayName: "Consumet",

  async searchAnime(query, page = 1, perPage = 24) {
    const json = await anilistGet(
      `/${encodeURIComponent(query)}?page=${page}&perPage=${perPage}`
    );
    const meta = pageInfoToMeta(json);
    const items: AnimeCardItem[] = (json?.results ?? []).map(toCard);
    return { items, total: meta.total || items.length, page, perPage, hasNextPage: meta.hasNextPage };
  },

  async advancedSearch(filters) {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    params.set("type", "ANIME");
    if (filters.genres?.length) params.set("genre", filters.genres[0]);
    if (filters.type) params.set("format", filters.type.toUpperCase());
    if (filters.status) params.set("status", filters.status);
    if (filters.year) params.set("year", String(filters.year));
    params.set("sort", JSON.stringify([sortToAniList(filters.sort)]));
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 24;
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    const json = await anilistGet(`/advanced-search?${params.toString()}`);
    const meta = pageInfoToMeta(json);
    const items: AnimeCardItem[] = (json?.results ?? []).map(toCard);
    return { items, total: meta.total || items.length, page, perPage, hasNextPage: meta.hasNextPage };
  },

  async getTrendingAnime(page = 1, perPage = 20) {
    const json = await cached(`consumet:trending:${page}:${perPage}`, 10 * 60_000, () =>
      anilistGet(`/trending?page=${page}&perPage=${perPage}`)
    );
    return (json?.results ?? []).map(toCard);
  },

  async getPopularAnime(page = 1, perPage = 20) {
    const json = await cached(`consumet:popular:${page}:${perPage}`, 30 * 60_000, () =>
      anilistGet(`/popular?page=${page}&perPage=${perPage}`)
    );
    return (json?.results ?? []).map(toCard);
  },

  async getRecentlyUpdated(page = 1, perPage = 20) {
    try {
      const json = await cached(`consumet:recent:${page}:${perPage}`, 5 * 60_000, () =>
        anilistGet(`/recent-episodes?page=${page}&perPage=${perPage}&provider=${STREAM_PROVIDER}`)
      );
      const items = (json?.results ?? []).map(toCard);
      if (items.length) return items;
    } catch {
      /* fall through to schedule-based recent */
    }
    const json = await anilistGet(
      `/advanced-search?${new URLSearchParams({
        type: "ANIME",
        sort: JSON.stringify(["START_DATE_DESC"]),
        status: "RELEASING",
        page: String(page),
        perPage: String(perPage),
      })}`
    );
    return (json?.results ?? []).map(toCard);
  },

  async getRecentlyAdded(page = 1, perPage = 20) {
    const json = await anilistGet(
      `/advanced-search?${new URLSearchParams({
        type: "ANIME",
        sort: JSON.stringify(["START_DATE_DESC"]),
        page: String(page),
        perPage: String(perPage),
      })}`
    );
    return (json?.results ?? []).map(toCard);
  },

  async getMostWatched(page = 1, perPage = 20) {
    return consumetProvider.getPopularAnime(page + 1, perPage);
  },

  async getByGenre(genre, page = 1, perPage = 20) {
    return consumetProvider.advancedSearch({ genres: [genre], page, perPage, sort: "POPULARITY" }).then((r) => r.items);
  },

  async getGenres() {
    return ANILIST_GENRES.map((name) => ({ name, count: 0 }));
  },

  async getAnimeDetails(id): Promise<AnimeDetails | null> {
    const json = await cached(`consumet:info:${id}`, 60 * 60_000, () => anilistGet(`/info?id=${encodeURIComponent(id)}`));
    if (!json || json.error) return null;
    const card = toCard(json);
    const cover = json.coverImage ?? {};
    return {
      ...card,
      image: card.image ?? cover.extraLarge ?? cover.large ?? null,
      description: stripHtml(json.description),
      season: json.season ?? null,
      studio: json.studios?.[0]?.name ?? json.studio ?? null,
      duration: json.duration ?? null,
      popularity: json.popularity ?? null,
      totalEpisodes: json.episodes ?? json.totalEpisodes ?? 0,
    };
  },

  async getEpisodes(id): Promise<EpisodeBundle> {
    const details = await consumetProvider.getAnimeDetails(id);
    if (!details) return { seasons: [], episodes: [] };
    const info = await anilistGet(`/info?id=${encodeURIComponent(id)}`);
    const raw: any[] = info?.episodes ?? [];
    const episodes: EpisodeListItem[] = raw.map((e, i) => ({
      id: String(e.id ?? `${id}-${i + 1}`),
      number: Number(e.number ?? i + 1),
      title: e.title ?? null,
      image: e.image ?? details.banner ?? null,
      filler: Boolean(e.filler),
      recap: Boolean(e.recap),
      airDate: e.airDate ?? null,
    }));
    const seasonCount = Math.max(1, Math.ceil(episodes.length / 100));
    const seasons = episodes.length
      ? Array.from({ length: seasonCount }, (_, i) => ({
          id: String(i + 1),
          name: seasonCount > 1 ? `Episodes ${i * 100 + 1}–${Math.min((i + 1) * 100, episodes.length)}` : "All Episodes",
          episodeCount: episodes.length,
        }))
      : [];
    return { seasons, episodes };
  },

  async findEpisodeId(animeId, episodeNumber) {
    const { episodes } = await consumetProvider.getEpisodes(animeId);
    return episodes.find((e) => e.number === episodeNumber)?.id ?? null;
  },

  async getEpisodeServers(episodeId): Promise<EpisodeServer[]> {
    try {
      const json = await streamGet(`/servers/${encodeURIComponent(episodeId)}`);
      const raw: any[] = Array.isArray(json) ? json : (json?.servers ?? []);
      const servers = raw
        .map((s, i) => ({
          id: String(s.name ?? `server-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: String(s.name ?? `Server ${i + 1}`),
          embedOnly: looksLikeEmbed(s.url),
          available: true,
        }))
        .filter((s) => !s.embedOnly);
      if (servers.length) return servers;
    } catch {
      /* fall back to generic list */
    }
    return [
      { id: "vidstreaming", name: "Vidstreaming", available: true },
      { id: "gogo", name: "Gogo Server", available: true },
      { id: "streamsb", name: "StreamSB", available: true },
      { id: "xstreamcdn", name: "XStreamCDN", available: true },
    ];
  },

  async getStreamingSources(episodeId, serverId): Promise<VideoSource[]> {
    const params = new URLSearchParams({ episodeId });
    if (serverId) params.set("server", serverId);
    const json = await streamGet(`/watch/${encodeURIComponent(episodeId)}?${params.toString()}`);
    const rawSources: any[] = json?.sources ?? [];
    const subtitles = (json?.headers ? [] : []).concat(
      (json?.subtitles ?? []).map((s: any, i: number) => ({
        id: `sub-${i}`,
        label: String(s.label ?? s.lang ?? `Subtitle ${i + 1}`),
        language: String(s.lang ?? s.language ?? "en"),
        url: String(s.url ?? s.file),
        kind: "subtitles" as const,
      }))
    );
    const headers = json?.headers && typeof json.headers === "object" ? json.headers : undefined;
    const sources: VideoSource[] = [];
    rawSources.forEach((s, i) => {
      const url = String(s.url ?? s.file ?? "");
      if (!url || !isDirectMedia(url)) return;
      sources.push({
        id: `${serverId ?? "default"}-${i}`,
        name: String(s.quality ? `${s.quality}` : `Source ${i + 1}`),
        url,
        type: mediaTypeOf(url),
        quality: s.quality ? String(s.quality) : undefined,
        subtitles: subtitles.length ? subtitles : undefined,
        headers: headers && Object.keys(headers).length ? headers : undefined,
      });
    });
    if (!sources.length) {
      throw new ProviderError("No direct stream URLs were extractable for this server.", 404);
    }
    return sources;
  },
};
