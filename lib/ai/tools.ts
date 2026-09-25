import { getProvider } from "@/lib/anime/providers";
import { getStore } from "@/lib/db/store";
import { cleanSynopsis } from "@/lib/anime/synopsis";
import { getMemory, applyMemoryPatch, memoryContext, sanitizeMemory } from "./memory";
import { getSessionUserId } from "@/lib/auth/auth";

/* ────────────────────────────────────────────────────────────────
   KURO AI TOOLS — the model's ONLY window into the platform.
   Every argument is validated; every result is trimmed to keep
   prompts small; user tools are hard-scoped to the caller's own id.
   ──────────────────────────────────────────────────────────────── */

export interface ToolContext {
  userId: string | null;
}

type JsonSchema = Record<string, unknown>;

export interface ToolDef {
  schema: JsonSchema;
  /** personal tools require an authenticated user */
  personal?: boolean;
}

/* ── Schemas (OpenAI function-calling format, provider-neutral) ── */

export const TOOLS: Record<string, ToolDef> = {
  searchAnime: {
    schema: {
      type: "function",
      function: {
        name: "searchAnime",
        description:
          "Search KURO's real anime catalog by keyword (title, franchise). Use for any 'is X available?' or 'find X' request. Returns compact results — use presentAnime to show cards.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search text, e.g. 'Demon Slayer'." },
            limit: { type: "integer", description: "1-10 results. Default 6." },
          },
          required: ["query"],
        },
      },
    },
  },
  discoverAnime: {
    schema: {
      type: "function",
      function: {
        name: "discoverAnime",
        description:
          "Filter/search the catalog by genre, type, status, year or sort. Use for vibe requests like 'dark psychological anime' or 'insanely OP MC' (combine genres + sort). Returns compact results.",
        parameters: {
          type: "object",
          properties: {
            genres: { type: "array", items: { type: "string" }, description: "e.g. ['Action','Psychological']" },
            query: { type: "string" },
            type: { type: "string", description: "TV | MOVIE | OVA | ONA | SPECIAL" },
            year: { type: "integer" },
            sort: { type: "string", description: "TRENDING | POPULARITY | RATING | NEWEST" },
            limit: { type: "integer", description: "1-10. Default 6." },
          },
        },
      },
    },
  },
  getAnime: {
    schema: {
      type: "function",
      function: {
        name: "getAnime",
        description: "Get full KURO details for one anime id (synopsis, genres, status, episode count).",
        parameters: {
          type: "object",
          properties: { animeId: { type: "string" } },
          required: ["animeId"],
        },
      },
    },
  },
  getEpisodes: {
    schema: {
      type: "function",
      function: {
        name: "getEpisodes",
        description: "Get the episode list summary (count + sample) for an anime id.",
        parameters: {
          type: "object",
          properties: { animeId: { type: "string" } },
          required: ["animeId"],
        },
      },
    },
  },
  getEpisode: {
    schema: {
      type: "function",
      function: {
        name: "getEpisode",
        description: "Check a specific episode number exists for an anime id.",
        parameters: {
          type: "object",
          properties: { animeId: { type: "string" }, episodeNumber: { type: "integer" } },
          required: ["animeId", "episodeNumber"],
        },
      },
    },
  },
  findSimilarAnime: {
    schema: {
      type: "function",
      function: {
        name: "findSimilarAnime",
        description: "Find KURO catalog anime similar to the given anime id (genre/style overlap).",
        parameters: {
          type: "object",
          properties: { animeId: { type: "string" }, limit: { type: "integer", description: "1-10, default 6" } },
          required: ["animeId"],
        },
      },
    },
  },
  getTrendingAnime: {
    schema: {
      type: "function",
      function: {
        name: "getTrendingAnime",
        description: "What's trending on KURO right now.",
        parameters: { type: "object", properties: {} },
      },
    },
  },
  presentAnime: {
    schema: {
      type: "function",
      function: {
        name: "presentAnime",
        description:
          "Render KURO anime cards inside your reply. Only pass ids you received from other tools — never invent ids. Shows real thumbnails, ratings and working Play/View buttons.",
        parameters: {
          type: "object",
          properties: {
            animeIds: { type: "array", items: { type: "string" }, description: "1-8 catalog ids." },
            resume: { type: "boolean", description: "true → each card's Play button resumes the user's latest episode." },
          },
          required: ["animeIds"],
        },
      },
    },
  },

  /* personal tools (authentication required) */
  getCurrentlyWatching: {
    personal: true,
    schema: {
      type: "function",
      function: {
        name: "getCurrentlyWatching",
        description: "Titles this user is actively watching (in progress, not completed).",
        parameters: { type: "object", properties: {} },
      },
    },
  },
  getContinueWatching: {
    personal: true,
    schema: {
      type: "function",
      function: {
        name: "getContinueWatching",
        description: "The single title/episode this user should resume next.",
        parameters: { type: "object", properties: {} },
      },
    },
  },
  getWatchHistory: {
    personal: true,
    schema: {
      type: "function",
      function: {
        name: "getWatchHistory",
        description: "This user's recent watch history (most recent first).",
        parameters: { type: "object", properties: {} },
      },
    },
  },
  getCompletedAnime: {
    personal: true,
    schema: {
      type: "function",
      function: { name: "getCompletedAnime", description: "Anime this user has completed.", parameters: { type: "object", properties: {} } },
    },
  },
  getWatchlist: {
    personal: true,
    schema: {
      type: "function",
      function: { name: "getWatchlist", description: "This user's saved watchlist.", parameters: { type: "object", properties: {} } },
    },
  },
  getFavorites: {
    personal: true,
    schema: {
      type: "function",
      function: { name: "getFavorites", description: "This user's favorited anime.", parameters: { type: "object", properties: {} } },
    },
  },
  getDroppedAnime: {
    personal: true,
    schema: {
      type: "function",
      function: {
        name: "getDroppedAnime",
        description: "Anime this user dropped. KURO does not track a dropped state yet — expect an honest empty result.",
        parameters: { type: "object", properties: {} },
      },
    },
  },
  getUserPreferences: {
    personal: true,
    schema: {
      type: "function",
      function: { name: "getUserPreferences", description: "The AI memory stored for this user (tastes, likes/dislikes).", parameters: { type: "object", properties: {} } },
    },
  },
  updateMemory: {
    personal: true,
    schema: {
      type: "function",
      function: {
        name: "updateMemory",
        description:
          "Save durable, distilled insight about this user (favorite genres, liked/disliked anime, preferences). Save sparingly — only meaningful, lasting facts the user shared or demonstrated. Not a chat log.",
        parameters: {
          type: "object",
          properties: {
            favoriteGenres: { type: "array", items: { type: "string" } },
            preferredThemes: { type: "array", items: { type: "string" } },
            likedAnime: {
              type: "array",
              items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } }, required: ["id", "title"] },
            },
            dislikedAnime: {
              type: "array",
              items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } }, required: ["id", "title"] },
            },
            recommendationPreferences: { type: "string", description: "One or two sentences of durable guidance." },
            notes: { type: "string", description: "Short free-form note (replaces previous)." },
          },
        },
      },
    },
  },
};

export function toolSchemasFor(userId: string | null): unknown[] {
  return Object.entries(TOOLS)
    .filter(([, def]) => !def.personal || Boolean(userId))
    .map(([, def]) => def.schema);
}

/* ── validation helpers ───────────────────────────────────────── */

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function int(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : dflt;
}
function strArr(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.slice(0, max).map((x) => str(x, 40)).filter(Boolean) : [];
}

/* ── compact catalog projections ──────────────────────────────── */

function compactItem(a: {
  id: string;
  title: string;
  year?: number | null;
  rating?: number | null;
  type?: string | null;
  episodes?: number | null;
  genres?: string[] | null;
}) {
  return {
    id: a.id,
    title: a.title,
    year: a.year ?? null,
    rating: a.rating ?? null,
    type: a.type ?? null,
    episodes: a.episodes ?? null,
    genres: (a.genres ?? []).slice(0, 4),
  };
}

/* ── executor ─────────────────────────────────────────────────── */

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: boolean; json: unknown }> {
  const def = TOOLS[name];
  if (!def) return { ok: false, json: { error: `Unknown tool ${name}` } };
  if (def.personal && !ctx.userId) {
    return { ok: false, json: { error: "This tool requires the user to be signed in to KURO." } };
  }

  const provider = getProvider();
  const store = getStore();

  try {
    switch (name) {
      case "searchAnime": {
        const q = str(rawArgs.query, 120);
        if (!q) return { ok: false, json: { error: "query is required" } };
        const res = await provider.searchAnime(q, 1, int(rawArgs.limit, 1, 10, 6));
        return {
          ok: true,
          json: {
            totalOnKuro: res.total,
            items: res.items.slice(0, 10).map(compactItem),
            hint: "Use presentAnime with chosen ids to show cards.",
          },
        };
      }

      case "discoverAnime": {
        const genres = strArr(rawArgs.genres, 3);
        const limit = int(rawArgs.limit, 1, 10, 6);
        const sortRaw = str(rawArgs.sort, 20).toUpperCase();
        const sort = (["TRENDING", "POPULARITY", "RATING", "NEWEST"].includes(sortRaw) ? sortRaw : "TRENDING") as
          | "TRENDING"
          | "POPULARITY"
          | "RATING"
          | "NEWEST";
        const res = await provider.advancedSearch({
          query: str(rawArgs.query, 120) || undefined,
          genres: genres.length ? genres : undefined,
          type: (str(rawArgs.type, 12).toUpperCase() || "") as never,
          year: rawArgs.year ? int(rawArgs.year, 1960, 2100, 0) || "" : "",
          sort,
          page: 1,
          perPage: Math.max(limit, 10),
        });
        // Light relevance filter for genre-only vibe queries.
        let items = res.items;
        if (!str(rawArgs.query, 120) && genres.length) {
          const wanted = genres.map((g) => g.toLowerCase());
          const strict = items.filter((a) =>
            wanted.every((g) => (a.genres ?? []).some((ag) => ag.toLowerCase().includes(g))),
          );
          if (strict.length >= 3) items = strict;
        }
        return {
          ok: true,
          json: { items: items.slice(0, limit).map(compactItem), hint: "Use presentAnime with chosen ids to show cards." },
        };
      }

      case "getAnime": {
        const d = await provider.getAnimeDetails(str(rawArgs.animeId, 64));
        if (!d) return { ok: true, json: { found: false, note: "Not in KURO's catalog." } };
        return {
          ok: true,
          json: {
            found: true,
            id: d.id,
            title: d.title,
            japaneseTitle: d.japaneseTitle ?? null,
            year: d.year ?? null,
            rating: d.rating ?? null,
            type: d.type ?? null,
            status: d.status ?? null,
            episodes: d.totalEpisodes ?? d.episodes ?? null,
            genres: (d.genres ?? []).slice(0, 8),
            studio: d.studio ?? null,
            synopsis: cleanSynopsis(d.description).slice(0, 400),
          },
        };
      }

      case "getEpisodes": {
        const id = str(rawArgs.animeId, 64);
        const bundle = await provider.getEpisodes(id);
        const eps = bundle.episodes;
        return {
          ok: true,
          json: {
            count: eps.length,
            first: eps.slice(0, 3).map((e) => ({ number: e.number, title: e.title ?? null })),
            latest: eps.at(-1)?.number ?? null,
          },
        };
      }

      case "getEpisode": {
        const id = str(rawArgs.animeId, 64);
        const n = int(rawArgs.episodeNumber, 1, 9999, 0);
        const bundle = await provider.getEpisodes(id);
        const ep = bundle.episodes.find((e) => e.number === n);
        if (!ep) {
          return { ok: true, json: { exists: false, count: bundle.episodes.length, note: `Episode ${n} not found.` } };
        }
        return { ok: true, json: { exists: true, number: ep.number, title: ep.title ?? null, id: ep.id } };
      }

      case "findSimilarAnime": {
        const id = str(rawArgs.animeId, 64);
        const limit = int(rawArgs.limit, 1, 10, 6);
        const d = await provider.getAnimeDetails(id);
        if (!d) return { ok: true, json: { items: [], note: "Origin title not found." } };
        const genres = (d.genres ?? []).slice(0, 2);
        if (!genres.length) return { ok: true, json: { items: [], note: "No genre data to compare." } };
        const res = await provider.advancedSearch({ genres, sort: "RATING", page: 1, perPage: limit * 3 });
        const items = res.items.filter((a) => a.id !== id).slice(0, limit);
        return {
          ok: true,
          json: {
            basedOn: { id: d.id, title: d.title, genres },
            items: items.map(compactItem),
            hint: "Use presentAnime with chosen ids to show cards.",
          },
        };
      }

      case "getTrendingAnime": {
        const items = await provider.getTrendingAnime(1, 8);
        return { ok: true, json: { items: items.map(compactItem) } };
      }

      /* personal tools — always scoped to ctx.userId */
      case "getCurrentlyWatching": {
        const all = await store.listProgress(ctx.userId!, { completed: false });
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return {
          ok: true,
          json: {
            items: all.slice(0, 10).map((p) => ({
              animeId: p.animeId,
              title: p.animeTitle,
              episodeNumber: p.episodeNumber,
              progressPct: p.duration > 0 ? Math.round((p.position / p.duration) * 100) : 0,
              updatedAt: p.updatedAt,
            })),
          },
        };
      }

      case "getContinueWatching": {
        const all = await store.listProgress(ctx.userId!, { completed: false });
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const p = all[0];
        return p
          ? {
              ok: true,
              json: {
                animeId: p.animeId,
                title: p.animeTitle,
                episodeNumber: p.episodeNumber,
                progressPct: p.duration > 0 ? Math.round((p.position / p.duration) * 100) : 0,
                hint: "Present with presentAnime(resume:true) so the Play button continues this episode.",
              },
            }
          : { ok: true, json: { item: null, note: "Nothing in progress yet." } };
      }

      case "getWatchHistory": {
        const all = await store.listProgress(ctx.userId!);
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return {
          ok: true,
          json: {
            items: all.slice(0, 15).map((p) => ({
              animeId: p.animeId,
              title: p.animeTitle,
              episodeNumber: p.episodeNumber,
              completed: p.completed,
              updatedAt: p.updatedAt,
            })),
          },
        };
      }

      case "getCompletedAnime": {
        const all = await store.listProgress(ctx.userId!, { completed: true });
        return {
          ok: true,
          json: { items: all.slice(0, 15).map((p) => ({ animeId: p.animeId, title: p.animeTitle })) },
        };
      }

      case "getWatchlist": {
        const items = await store.listWatchlist(ctx.userId!);
        return {
          ok: true,
          json: { items: items.slice(0, 15).map((i) => ({ animeId: i.animeId, title: i.animeTitle, year: i.animeYear ?? null })) },
        };
      }

      case "getFavorites": {
        const items = await store.listFavorites(ctx.userId!);
        return {
          ok: true,
          json: { items: items.slice(0, 15).map((i) => ({ animeId: i.animeId, title: i.animeTitle })) },
        };
      }

      case "getDroppedAnime":
        return {
          ok: true,
          json: { items: [], note: "KURO doesn't track a dropped state yet — tell the user honestly." },
        };

      case "getUserPreferences": {
        const mem = await getMemory(ctx.userId!);
        return { ok: true, json: { memory: sanitizeMemory(mem), summary: memoryContext(mem) || "No memory saved yet." } };
      }

      case "updateMemory": {
        const mem = await applyMemoryPatch(ctx.userId!, rawArgs);
        return { ok: true, json: { saved: true, summary: memoryContext(mem) } };
      }

      default:
        return { ok: false, json: { error: `Unhandled tool ${name}` } };
    }
  } catch (err) {
    return {
      ok: false,
      json: { error: `Tool failed: ${err instanceof Error ? err.message.slice(0, 160) : "unknown"}` },
    };
  }
}

/* presentAnime needs the session too (resume) — resolved in run.ts */

export async function requireUserIdForTools(): Promise<string | null> {
  return getSessionUserId();
}
