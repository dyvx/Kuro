import { hasMongo, getDb } from "@/lib/db/mongo";

/* ────────────────────────────────────────────────────────────────
   AI MEMORY — minimal, structured, per-user, privacy-conscious.
   NOT a conversation log: only distilled preferences the assistant
   explicitly chooses to save (via its updateMemory tool). The user
   can inspect and clear it at any time from the AI page.
   ──────────────────────────────────────────────────────────────── */

export interface AIMemory {
  favoriteGenres: string[];
  preferredThemes?: string[];
  likedAnime: { id: string; title: string }[];
  dislikedAnime: { id: string; title: string }[];
  favoriteCharacters?: string[];
  recommendationPreferences?: string;
  notes?: string;
  updatedAt?: string;
}

const EMPTY: AIMemory = {
  favoriteGenres: [],
  preferredThemes: [],
  likedAnime: [],
  dislikedAnime: [],
  favoriteCharacters: [],
  recommendationPreferences: "",
  notes: "",
};

const MAX_GENRES = 12;
const MAX_TITLES = 20;
const MAX_CHARS = 600;

const COLLECTION = "ai_memory";

/* No Mongo (demo mode)? Fall back to a process-local map so AI memory
   still works for the running instance — it simply resets on restart. */
const memoryFallback = new Map<string, AIMemory>();

function sanitizeRefList(
  list: unknown,
): { id: string; title: string }[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_TITLES)
    .map((item) => {
      const r = item as { id?: unknown; title?: unknown };
      return { id: String(r.id ?? "").slice(0, 64), title: String(r.title ?? "").slice(0, 120) };
    })
    .filter((r) => r.id && r.title);
}

export function sanitizeMemory(raw: unknown): AIMemory {
  const m = (raw ?? {}) as Record<string, unknown>;
  const strArr = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v.slice(0, max).map((x) => String(x).slice(0, 40)).filter(Boolean)
      : [];
  return {
    favoriteGenres: strArr(m.favoriteGenres, MAX_GENRES),
    preferredThemes: strArr(m.preferredThemes, MAX_GENRES),
    likedAnime: sanitizeRefList(m.likedAnime),
    dislikedAnime: sanitizeRefList(m.dislikedAnime),
    favoriteCharacters: strArr(m.favoriteCharacters, MAX_TITLES),
    recommendationPreferences: String(m.recommendationPreferences ?? "").slice(0, 300),
    notes: String(m.notes ?? "").slice(0, MAX_CHARS),
    updatedAt: typeof m.updatedAt === "string" ? m.updatedAt : undefined,
  };
}

export async function getMemory(userId: string): Promise<AIMemory> {
  if (!hasMongo()) return memoryFallback.get(userId) ?? EMPTY;
  try {
    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ userId });
    return doc ? sanitizeMemory(doc) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Validated patch applied by the AI's own updateMemory tool. */
export async function applyMemoryPatch(userId: string, patch: Record<string, unknown>): Promise<AIMemory> {
  const current = await getMemory(userId);
  const next: AIMemory = { ...current };

  const genres = patch.favoriteGenres;
  if (Array.isArray(genres)) next.favoriteGenres = genres.slice(0, MAX_GENRES).map((g) => String(g).slice(0, 40)).filter(Boolean);

  const themes = patch.preferredThemes;
  if (Array.isArray(themes)) next.preferredThemes = themes.slice(0, MAX_GENRES).map((g) => String(g).slice(0, 40)).filter(Boolean);

  if (patch.likedAnime !== undefined) next.likedAnime = sanitizeRefList(patch.likedAnime);
  if (patch.dislikedAnime !== undefined) next.dislikedAnime = sanitizeRefList(patch.dislikedAnime);

  const chars = patch.favoriteCharacters;
  if (Array.isArray(chars)) next.favoriteCharacters = chars.slice(0, MAX_TITLES).map((c) => String(c).slice(0, 60)).filter(Boolean);

  if (typeof patch.recommendationPreferences === "string") next.recommendationPreferences = patch.recommendationPreferences.slice(0, 300);
  if (typeof patch.notes === "string") next.notes = patch.notes.slice(0, MAX_CHARS);

  next.updatedAt = new Date().toISOString();

  if (hasMongo()) {
    try {
      const db = await getDb();
      await db.collection(COLLECTION).updateOne(
        { userId },
        { $set: next as never },
        { upsert: true },
      );
    } catch {
      /* memory writes are best-effort */
    }
  } else {
    memoryFallback.set(userId, next);
  }
  return next;
}

export async function clearMemory(userId: string): Promise<void> {
  if (!hasMongo()) {
    memoryFallback.delete(userId);
    return;
  }
  try {
    const db = await getDb();
    await db.collection(COLLECTION).deleteOne({ userId });
  } catch {
    /* ignore */
  }
}

/** Compact prompt-context projection (never the raw doc). */
export function memoryContext(m: AIMemory): string {
  const bits: string[] = [];
  if (m.favoriteGenres.length) bits.push(`Favorite genres: ${m.favoriteGenres.join(", ")}`);
  if (m.preferredThemes?.length) bits.push(`Preferred themes: ${m.preferredThemes.join(", ")}`);
  if (m.likedAnime.length) bits.push(`Likes: ${m.likedAnime.map((a) => a.title).join(", ")}`);
  if (m.dislikedAnime.length) bits.push(`Dislikes: ${m.dislikedAnime.map((a) => a.title).join(", ")}`);
  if (m.favoriteCharacters?.length) bits.push(`Favorite characters: ${m.favoriteCharacters.join(", ")}`);
  if (m.recommendationPreferences) bits.push(`Preferences: ${m.recommendationPreferences}`);
  if (m.notes) bits.push(`Notes: ${m.notes}`);
  return bits.join("\n");
}
