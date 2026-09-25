import { cached, fetchUpstream } from "../cache";
import { kuhiConfigured } from "./kuhi-stream";

/* ────────────────────────────────────────────────────────────────
   KUHI SEARCH RESOLVER (metadata search fallback)

   AniList's search engine misses pinyin/alternate titles ("Dubu
   Xiaoyao", "Yao Shen Ji", …) even though the entries exist on
   AniList itself. Kuhi's search resolves them and returns AniList
   IDs, so this module acts purely as a RESOLVER: query in → AniList
   IDs out → the AniList provider renders its own full metadata.

   Never used for covers/descriptions/episodes — AniList stays the
   single source of truth. Any failure returns null and search
   behaves exactly as before.
   ──────────────────────────────────────────────────────────────── */

/** Resolve a free-text query to AniList IDs via the Kuhi instance. */
export async function kuhiResolveSearch(query: string): Promise<number[] | null> {
  if (!kuhiConfigured()) return null;
  const q = query.trim();
  if (!q) return null;
  try {
    return await cached(`kuhi:resolve:${q.toLowerCase()}`, 60 * 60_000, async () => {
      const base = (process.env.ANIME_KUHI_BASE_URL ?? "").replace(/\/+$/, "");
      const res = await fetchUpstream(
        `${base}/anime/search?query=${encodeURIComponent(q)}`,
        { headers: { accept: "application/json" }, timeoutMs: 45_000, retries: 0 } as RequestInit
      );
      if (!res.ok) return [];
      const json: any = await res.json();
      const results: any[] = Array.isArray(json?.results) ? json.results : [];
      const ids = results
        .map((r) => Number(r?.id))
        .filter((n) => Number.isFinite(n) && n > 0);
      return Array.from(new Set(ids)).slice(0, 24);
    });
  } catch {
    return null;
  }
}
