import type {
  AnimeCardItem,
  AnimeDetails,
  EpisodeBundle,
  EpisodeListItem,
  SearchFilters,
  SearchResult,
} from "@/types/anime";
import { cached, fetchUpstream } from "../cache";

/* ────────────────────────────────────────────────────────────────
   ANILIST GRAPHQL CLIENT (metadata only)
   Used by the anivexa provider: AniList supplies discovery +
   details, while the Anivexa instance supplies episodes/streams.
   No API key required; responses are cached to respect rate limits.
   ──────────────────────────────────────────────────────────────── */


const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  format
  status
  episodes
  duration
  season
  seasonYear
  averageScore
  popularity
  genres
  studios(isMain: true) { nodes { name } }
`;

const PAGE_QUERY = `
query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort],
       $genre: [String], $status: MediaStatus, $format: MediaFormat,
       $startDate: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total hasNextPage }
    media(type: ANIME, search: $search, sort: $sort, genre_in: $genre,
          status: $status, format: $format, startDate_greater: $startDate,
          isAdult: false) {
      ${MEDIA_FIELDS}
    }
  }
}`;

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} description(asHtml: false) }
}`;

export async function anilistQuery(
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const key = `anilist:${JSON.stringify({ query: query.slice(0, 64), variables })}`;
  return cached(key, 10 * 60_000, async () => {
    const res = await fetchUpstream(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 15_000,
      retries: 1,
    } as RequestInit);
    if (!res.ok) throw new Error(`AniList request failed (${res.status})`);
    const json = await res.json();
    if (json?.errors?.length) {
      throw new Error(json.errors[0]?.message ?? "AniList query error");
    }
    return json?.data;
  });
}

function mapCard(m: any): AnimeCardItem {
  return {
    id: String(m.id),
    title: m.title?.romaji ?? m.title?.english ?? "Unknown",
    englishTitle: m.title?.english && m.title.english !== m.title?.romaji ? m.title.english : null,
    japaneseTitle: m.title?.native ?? null,
    image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    banner: m.bannerImage ?? null,
    color: m.coverImage?.color ?? null,
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : null,
    year: m.seasonYear ?? null,
    type:
      m.format === "MOVIE" ? "Movie" : m.format === "ONA" ? "ONA" : m.format === "OVA" ? "OVA" : "TV",
    episodes: m.episodes ?? null,
    genres: m.genres ?? [],
    status: (m.status ?? "FINISHED") as AnimeCardItem["status"],
  };
}

export function mapDetails(m: any): AnimeDetails {
  return {
    ...mapCard(m),
    description: (m.description ?? "").replace(/<[^>]*>/g, "").replace(/&(#?\w+);/g, " ").trim(),
    season: m.season ?? null,
    studio: m.studios?.nodes?.[0]?.name ?? null,
    duration: m.duration ?? null,
    popularity: m.popularity ?? null,
    totalEpisodes: m.episodes ?? 0,
  };
}

function sortToQuery(sort: SearchFilters["sort"]): string[] {
  switch (sort) {
    case "POPULARITY":
      return ["POPULARITY_DESC"];
    case "RATING":
      return ["SCORE_DESC"];
    case "NEWEST":
      return ["START_DATE_DESC"];
    case "TITLE":
      return ["TITLE_ROMAJI"];
    default:
      return ["TRENDING_DESC"];
  }
}

const FUZZY_FORMATS: Record<string, string> = {
  TV: "TV",
  Movie: "MOVIE",
  OVA: "OVA",
  ONA: "ONA",
  Special: "SPECIAL",
};

const STATUS_FORMATS: Record<string, string> = {
  RELEASING: "RELEASING",
  FINISHED: "FINISHED",
  UPCOMING: "NOT_YET_RELEASED",
};

export async function anilistAdvancedSearch(filters: SearchFilters): Promise<SearchResult> {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 24;
  const data = await anilistQuery(PAGE_QUERY, {
    page,
    perPage,
    search: filters.query?.trim() || undefined,
    sort: sortToQuery(filters.sort),
    genre: filters.genres?.length ? filters.genres : undefined,
    status: filters.status ? STATUS_FORMATS[filters.status] : undefined,
    format: filters.type ? FUZZY_FORMATS[filters.type] : undefined,
    startDate: filters.year ? Number(filters.year) * 10000 : undefined,
  });
  const media: any[] = data?.Page?.media ?? [];
  return {
    items: media.map(mapCard),
    total: data?.Page?.pageInfo?.total ?? media.length,
    page,
    perPage,
    hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
  };
}

export async function anilistPage(
  sort: string[],
  page = 1,
  perPage = 20,
  extra: Record<string, unknown> = {}
): Promise<AnimeCardItem[]> {
  const data = await anilistQuery(PAGE_QUERY, { page, perPage, sort, ...extra });
  return ((data?.Page?.media ?? []) as any[]).map(mapCard);
}

export async function anilistDetails(id: string): Promise<AnimeDetails | null> {
  const numeric = Number(id);
  if (!Number.isFinite(numeric)) return null;
  try {
    const data = await anilistQuery(DETAILS_QUERY, { id: numeric });
    return data?.Media ? mapDetails(data.Media) : null;
  } catch {
    return null;
  }
}

/** Best-effort episode list straight from AniList (titles only, when published). */
export function anilistFallbackEpisodes(details: AnimeDetails): EpisodeBundle {
  const count = Math.max(0, Math.min(details.totalEpisodes || 0, 200));
  return {
    seasons: count ? [{ id: "1", name: "All Episodes", episodeCount: count }] : [],
    episodes: Array.from({ length: count }, (_, i) => ({
      id: `ep-${i + 1}`,
      number: i + 1,
      title: null,
    })),
  };
}

export const ANILIST_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
  "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi",
  "Slice of Life", "Sports", "Supernatural", "Thriller",
];
