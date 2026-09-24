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
import { hashString, isDirectMedia, mediaTypeOf } from "../shared";
import raw from "./data.json";

/* ────────────────────────────────────────────────────────────────
   DEMO PROVIDER — bundled offline catalog.
   Metadata: factual fields (titles/years/genres/counts) + image URLs.
   Synopses and episode titles are ORIGINAL to this project.
   Streams: free public test streams (Mux / Apple / Unified Streaming /
   Blender open movies) so playback, switching and failure handling
   are fully exercisable without any paid API.
   ──────────────────────────────────────────────────────────────── */

interface DemoEntry {
  id: string;
  anilistId: number;
  title: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  image: string | null;
  banner: string | null;
  color: string | null;
  type: string;
  status: string;
  season: string | null;
  year: number | null;
  rating: number | null;
  episodes: number | null;
  duration: number | null;
  popularity: number;
  genres: string[];
  studio: string | null;
  synopsis: string;
  featured: number;
  addedOrder: number;
}

const DATA = raw as DemoEntry[];
const byId = new Map(DATA.map((a) => [a.id, a]));

/* Original invented episode titles (project-authored, generic phrases). */
const EPISODE_TITLES = [
  "A New Dawn", "The Promise", "Broken Blades", "Whispers in the Rain",
  "Scarlet Hour", "The Long Road", "Ashes and Ember", "First Light",
  "The Gambit", "Silent Thunder", "Paper Crowns", "What Remains",
  "The Deep End", "Twin Stars", "Cold Open", "The Iron Price",
  "Hollow Victory", "Glass Houses", "The Turning Tide", "Signal Lost",
  "Homecoming", "The Empty Throne", "Borrowed Time", "Static",
  "The Last Mile", "Small Wars", "Fever Dream", "The Art of Falling",
  "Crossroads", "Nightfall", "The Sixth Bell", "Salt and Smoke",
  "An Honest Mistake", "The Quiet Part", "Overgrowth", "Second Wind",
  "The Debt", "Northbound", "Old Wounds", "Bright Nothing",
  "The Understudy", "Fault Lines", "The Inheritance", "Dawn Chorus",
  "Terminal Velocity", "The Long Way Down", "Ember Watch", "Half Light",
];

/* Public test streams (free, ad-free, well-known playback fixtures). */
const STREAMS = [
  {
    name: "Vidcloud",
    id: "vidcloud",
    url: "https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8",
    quality: "1080p",
  },
  {
    name: "MegaPlay",
    id: "megaplay",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    quality: "1080p",
  },
  {
    name: "NovaStream",
    id: "novastream",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    quality: "1080p",
  },
  {
    name: "FileVault",
    id: "filevault",
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4",
    quality: "720p",
  },
];

/* Intentionally unreachable — lets users see the manual failure flow. */
const BROKEN_SERVER: EpisodeServer = { id: "stormhost", name: "StormHost", available: true };

/* Embed-only source — must be omitted from the UI (spec: pirate mode). */
const EMBED_SERVER: EpisodeServer = { id: "kuro-embed", name: "KuroFrame", embedOnly: true, available: true };

const DEMO_SUBTITLE: SubtitleTrack = {
  id: "demo-en",
  label: "English (demo)",
  language: "en",
  url: "/subs/demo-en.vtt",
  kind: "subtitles",
};

/* Curated tag sections for genres AniList doesn't expose directly. */
const TAG_SECTIONS: Record<string, string[]> = {
  Isekai: ["mushoku-tensei-isekai-ittara-honki-dasu", "re-zero-kara-hajimeru-isekai-seikatsu", "kono-subarashii-sekai-ni-shukufuku-wo", "sousou-no-frieren"],
  Shounen: ["jujutsu-kaisen", "kimetsu-no-yaiba", "one-piece", "chainsaw-man", "boku-no-hero-academia", "hunter-hunter-2011", "spy-family", "bocchi-the-rock"],
  Seinen: ["vinland-saga", "monster", "odd-taxi", "cowboy-bebop", "shin-seiki-evangelion", "cyberpunk-edgerunners", "code-geass-hangyaku-no-lelouch", "86-eighty-six"],
};

const GENRE_ICONS_ORDER = ["Action", "Romance", "Fantasy", "Psychological", "Isekai", "Shounen", "Seinen"];

const cap = (n: number) => Math.max(0, Math.min(n, 48));

function episodeCountFor(a: DemoEntry): number {
  if (a.type === "Movie") return 1;
  return a.episodes ? cap(a.episodes) : 12;
}

function episodeTitle(animeId: string, n: number): string {
  const h = hashString(`${animeId}:${n}`);
  return EPISODE_TITLES[h % EPISODE_TITLES.length];
}

function toCard(a: DemoEntry): AnimeCardItem {
  return {
    id: a.id,
    title: a.title,
    englishTitle: a.englishTitle,
    japaneseTitle: a.japaneseTitle,
    image: a.image,
    banner: a.banner,
    color: a.color,
    rating: a.rating,
    year: a.year,
    type: a.type as AnimeCardItem["type"],
    episodes: a.episodes,
    genres: a.genres,
    status: a.status as AnimeCardItem["status"],
  };
}

function paginate<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}

function match(query: string): DemoEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DATA.filter((a) =>
    [a.title, a.englishTitle, a.japaneseTitle, a.synopsis]
      .filter(Boolean)
      .some((t) => (t as string).toLowerCase().includes(q))
  );
}

function sortEntries(entries: DemoEntry[], sort: SearchFilters["sort"]): DemoEntry[] {
  const list = [...entries];
  switch (sort) {
    case "POPULARITY":
      return list.sort((a, b) => b.popularity - a.popularity);
    case "RATING":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "NEWEST":
      return list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    case "TITLE":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "TRENDING":
    default:
      return list.sort(
        (a, b) => (a.featured || 99) - (b.featured || 99) || b.popularity - a.popularity
      );
  }
}

function searchResult(entries: DemoEntry[], filters: SearchFilters): SearchResult {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 24;
  const total = entries.length;
  return {
    items: paginate(entries, page, perPage).map(toCard),
    total,
    page,
    perPage,
    hasNextPage: page * perPage < total,
  };
}

function serversFor(episodeId: string): EpisodeServer[] {
  // Deterministic rotation so different episodes lead with different servers.
  const h = hashString(episodeId);
  const rotated = [...STREAMS.slice(h % STREAMS.length), ...STREAMS.slice(0, h % STREAMS.length)];
  return [
    ...rotated.map((s) => ({ id: s.id, name: s.name, available: true })),
    BROKEN_SERVER,
    EMBED_SERVER,
  ];
}

function sourcesFor(episodeId: string, serverId?: string): VideoSource[] {
  const servers = serversFor(episodeId);
  const target = servers.find((s) => s.id === serverId) ?? servers[0];
  if (!target || target.embedOnly) return [];
  if (target.id === BROKEN_SERVER.id) {
    // Realistic failure: an unreachable host so the player surfaces an error.
    return [
      {
        id: "stormhost-0",
        name: BROKEN_SERVER.name,
        url: "https://kuro-broken-server.invalid/manifest.m3u8",
        type: "hls",
        quality: "1080p",
        subtitles: [DEMO_SUBTITLE],
      },
    ];
  }
  const stream = STREAMS.find((s) => s.id === target.id) ?? STREAMS[0];
  const sources: VideoSource[] = [
    {
      id: `${stream.id}-0`,
      name: stream.name,
      url: stream.url,
      type: mediaTypeOf(stream.url) as VideoSource["type"],
      quality: stream.quality,
      subtitles: [DEMO_SUBTITLE],
    },
  ];
  return sources;
}

export const demoProvider: AnimeProvider = {
  id: "demo",
  displayName: "KURO Demo",

  async searchAnime(query, page = 1, perPage = 24) {
    const hits = match(query).sort((a, b) => b.popularity - a.popularity);
    const total = hits.length;
    return {
      items: paginate(hits, page, perPage).map(toCard),
      total,
      page,
      perPage,
      hasNextPage: page * perPage < total,
    };
  },

  async advancedSearch(filters) {
    let entries = match(filters.query ?? "");
    if (!filters.query) entries = DATA;
    if (filters.genres?.length) {
      entries = entries.filter((a) => {
        const explicit = filters.genres!.every((g) => {
          if (TAG_SECTIONS[g]) return TAG_SECTIONS[g].includes(a.id);
          return a.genres.includes(g);
        });
        const loose =
          !explicit &&
          filters.genres!.some((g) => TAG_SECTIONS[g]?.includes(a.id) || a.genres.includes(g));
        return explicit || loose;
      });
    }
    if (filters.type) entries = entries.filter((a) => a.type === filters.type);
    if (filters.status) entries = entries.filter((a) => a.status === filters.status);
    if (filters.year) entries = entries.filter((a) => a.year === Number(filters.year));
    entries = sortEntries(entries, filters.sort);
    return searchResult(entries, filters);
  },

  async getTrendingAnime(page = 1, perPage = 20) {
    const entries = sortEntries(DATA, "TRENDING");
    return paginate(entries, page, perPage).map(toCard);
  },

  async getPopularAnime(page = 1, perPage = 20) {
    const entries = sortEntries(DATA, "POPULARITY");
    return paginate(entries, page, perPage).map(toCard);
  },

  async getRecentlyUpdated(page = 1, perPage = 20) {
    // RELEASING titles first, then a stable pseudo-random rotation.
    const releasing = DATA.filter((a) => a.status === "RELEASING");
    const rest = DATA.filter((a) => a.status !== "RELEASING").sort(
      (a, b) => hashString(b.id) % 1000 - hashString(a.id) % 1000
    );
    const entries = [...releasing.sort((a, b) => b.popularity - a.popularity), ...rest];
    return paginate(entries, page, perPage).map(toCard);
  },

  async getRecentlyAdded(page = 1, perPage = 20) {
    const entries = [...DATA].sort((a, b) => b.addedOrder - a.addedOrder);
    return paginate(entries, page, perPage).map(toCard);
  },

  async getMostWatched(page = 1, perPage = 20) {
    const entries = [...DATA].sort((a, b) => {
      const sa = a.popularity * (a.rating ?? 5);
      const sb = b.popularity * (b.rating ?? 5);
      return sb - sa;
    });
    return paginate(entries, page, perPage).map(toCard);
  },

  async getByGenre(genre, page = 1, perPage = 20) {
    const tagIds = TAG_SECTIONS[genre];
    const entries = tagIds
      ? tagIds.map((id) => byId.get(id)).filter((a): a is DemoEntry => Boolean(a))
      : DATA.filter((a) => a.genres.includes(genre)).sort((a, b) => b.popularity - a.popularity);
    return paginate(entries, page, perPage).map(toCard);
  },

  async getGenres() {
    const counts = new Map<string, number>();
    for (const g of GENRE_ICONS_ORDER) counts.set(g, TAG_SECTIONS[g]?.length ?? 0);
    for (const a of DATA) {
      for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },

  async getAnimeDetails(id) {
    const a = byId.get(id);
    if (!a) return null;
    return {
      ...toCard(a),
      description: a.synopsis,
      season: a.season,
      studio: a.studio,
      duration: a.duration,
      popularity: a.popularity,
      totalEpisodes: a.episodes ?? episodeCountFor(a),
    };
  },

  async getEpisodes(id): Promise<EpisodeBundle> {
    const a = byId.get(id);
    if (!a) return { seasons: [], episodes: [] };
    const count = episodeCountFor(a);
    const episodes: EpisodeListItem[] = Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const h = hashString(`${id}:filler:${n}`);
      return {
        id: `${id}-ep-${n}`,
        number: n,
        title: a.type === "Movie" ? "Feature Presentation" : episodeTitle(id, n),
        filler: a.type === "TV" && count > 20 && h % 17 === 0,
        duration: a.duration ?? 24,
      };
    });
    return {
      seasons: count > 0 ? [{ id: "1", name: "Season 1", episodeCount: count }] : [],
      episodes,
    };
  },

  async findEpisodeId(animeId, episodeNumber) {
    const a = byId.get(animeId);
    if (!a) return null;
    const count = episodeCountFor(a);
    if (episodeNumber < 1 || episodeNumber > count) return null;
    return `${animeId}-ep-${episodeNumber}`;
  },

  async getEpisodeServers(episodeId) {
    return serversFor(episodeId);
  },

  async getStreamingSources(episodeId, serverId) {
    const sources = sourcesFor(episodeId, serverId);
    // Guard clause keeps the contract honest — direct media only.
    return sources.filter((s) => isDirectMedia(s.url));
  },
};
