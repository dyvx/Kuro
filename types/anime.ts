/* ── KURO anime domain types ─────────────────────────────────
   These are the normalized shapes the entire UI consumes.
   Provider adapters (Consumet / Anify / demo) map their raw API
   responses into these structures, so the UI never depends on a
   specific upstream format. ─────────────────────────────────── */

export type AnimeType = "TV" | "Movie" | "OVA" | "ONA" | "Special";
export type AnimeStatus =
  | "RELEASING"
  | "FINISHED"
  | "UPCOMING"
  | "CANCELLED"
  | "HIATUS";

/** A direct, playable media stream. Embed pages are never accepted. */
export interface TimeWindow {
  start: number;
  end: number;
}

export interface VideoSource {
  id: string;
  /** Human-facing server/source name, e.g. "Vidcloud". */
  name: string;
  url: string;
  /** The un-proxied media URL (used for validation/diagnostics). */
  originalUrl?: string;
  type: "hls" | "mp4";
  quality?: string;
  subtitles?: SubtitleTrack[];
  headers?: Record<string, string>;
  /** Audio track category when the provider distinguishes sub/dub. */
  category?: "sub" | "dub" | "raw";
  /** Opening theme window (seconds) for the Skip Intro feature, when known. */
  intro?: TimeWindow;
  /** Ending theme window (seconds) for the Skip Outro feature, when known. */
  outro?: TimeWindow;
  /** Recap window (seconds), when known (AniSkip `recap`). */
  recap?: TimeWindow;
}

/** A selectable server slot for an episode. */
export interface EpisodeServer {
  id: string;
  /** Display name, e.g. "Vidcloud", "Server 2". */
  name: string;
  /** True when the API only offers an iframe embed (excluded from UI). */
  embedOnly?: boolean;
  /** Availability hint from the provider, when known. */
  available?: boolean;
  /** Audio category for providers with sub/dub server pools. */
  category?: "sub" | "dub" | "raw";
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  kind: "subtitles" | "captions";
}

/** Compact card shape used by grids, carousels and search results. */
export interface AnimeCardItem {
  id: string;
  title: string;
  englishTitle?: string | null;
  japaneseTitle?: string | null;
  image: string | null;
  banner?: string | null;
  color?: string | null;
  rating?: number | null;
  year?: number | null;
  type: AnimeType;
  episodes?: number | null;
  genres?: string[];
  status?: AnimeStatus;
}

/** Full detail shape for /anime/[id]. */
export interface AnimeDetails extends AnimeCardItem {
  description: string;
  /** MyAnimeList id (AniList `idMal`) — used by skip-time providers. */
  malId?: number | null;
  season?: string | null;
  studio?: string | null;
  duration?: number | null;
  popularity?: number | null;
  totalEpisodes: number;
}

export interface EpisodeListItem {
  id: string;
  number: number;
  title?: string | null;
  image?: string | null;
  filler?: boolean;
  recap?: boolean;
  duration?: number | null;
  airDate?: string | null;
}

export interface SeasonInfo {
  id: string;
  name: string;
  episodeCount: number;
}

export interface EpisodeBundle {
  seasons: SeasonInfo[];
  /** Flat, ordered episode list (current season pre-applied by provider). */
  episodes: EpisodeListItem[];
}

export type SortOption =
  | "TRENDING"
  | "POPULARITY"
  | "RATING"
  | "NEWEST"
  | "TITLE";

export interface SearchFilters {
  query?: string;
  genres?: string[];
  type?: AnimeType | "";
  status?: AnimeStatus | "";
  year?: number | "";
  sort?: SortOption;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  items: AnimeCardItem[];
  total: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

export type ProviderId = "demo" | "consumet" | "anify" | "anivexa";

/** The provider contract every adapter implements. */
export interface AnimeProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  searchAnime(query: string, page?: number, perPage?: number): Promise<SearchResult>;
  advancedSearch(filters: SearchFilters): Promise<SearchResult>;
  getTrendingAnime(page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getPopularAnime(page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getRecentlyUpdated(page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getRecentlyAdded(page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getMostWatched(page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getByGenre(genre: string, page?: number, perPage?: number): Promise<AnimeCardItem[]>;
  getGenres(): Promise<{ name: string; count: number }[]>;
  getAnimeDetails(id: string): Promise<AnimeDetails | null>;
  getEpisodes(id: string): Promise<EpisodeBundle>;
  /** Resolve which episode-id belongs to a human episode number. */
  findEpisodeId(animeId: string, episodeNumber: number): Promise<string | null>;
  getEpisodeServers(episodeId: string, animeId?: string): Promise<EpisodeServer[]>;
  /** Extract direct .m3u8 / .mp4 sources for a given server. */
  getStreamingSources(episodeId: string, serverId?: string, animeId?: string): Promise<VideoSource[]>;
}

export interface SectionSlug {
  slug:
    | "trending"
    | "popular"
    | "recent-updated"
    | "recent-added"
    | "most-watched"
    | "action"
    | "romance"
    | "fantasy"
    | "psychological"
    | "isekai"
    | "shounen"
    | "seinen";
}

export const SECTION_GENRES: Partial<Record<SectionSlug["slug"], string>> = {
  action: "Action",
  romance: "Romance",
  fantasy: "Fantasy",
  psychological: "Psychological",
  isekai: "Isekai",
  shounen: "Shounen",
  seinen: "Seinen",
};
