import { getProvider } from "@/lib/anime/providers";
import type { DataStore, StoredProgress, UserActivityDay } from "@/lib/db/store";

/* ────────────────────────────────────────────────────────────────
   WATCHING STATS — computed server-side from real KURO activity.
   No fabricated numbers: everything derives from the progress /
   watchlist / favorites / activity collections. Genre insights use
   the provider's cached details for the user's most-watched titles.
   ──────────────────────────────────────────────────────────────── */

export interface WatchingStats {
  animeCount: number;
  episodeCount: number;
  /** Approximate hours actually watched (sum of recorded positions). */
  watchHours: number;
  completedCount: number;
  watchingCount: number;
  watchlistCount: number;
  favoritesCount: number;
  topGenres: { genre: string; count: number }[];
  recentlyWatched: { animeId: string; title: string; image: string | null; episodeNumber: number; updatedAt: string }[];
  longestCompleted: { animeId: string; title: string; episodes: number } | null;
  streakDays: number;
  generatedAt: string;
}

/** Distinct-consecutive-day streak ending today or yesterday. */
function computeStreak(days: UserActivityDay[]): number {
  const set = new Set(days.map((d) => d.day));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to start yesterday (today may not have watching yet).
  if (!set.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function computeWatchingStats(userId: string, store: DataStore): Promise<WatchingStats> {
  const [progress, watchlist, favorites, activity] = await Promise.all([
    store.listProgress(userId),
    store.listWatchlist(userId),
    store.listFavorites(userId),
    store.listActivity(userId, 180).catch(() => [] as UserActivityDay[]),
  ]);

  const watching = progress.filter((p) => !p.completed);
  const completed = progress.filter((p) => p.completed);

  // Real recorded playback positions — the best honest watch-time measure.
  const watchedSeconds = progress.reduce((sum, p) => sum + Math.min(p.position, p.duration || p.position), 0);

  const recent: StoredProgress[] = [...progress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Genre insight from the provider (L1/L2 cached — cheap for top titles).
  let topGenres: { genre: string; count: number }[] = [];
  try {
    const provider = getProvider();
    const top = recent.slice(0, 8);
    const details = await Promise.all(top.map((p) => provider.getAnimeDetails(p.animeId).catch(() => null)));
    const counts = new Map<string, number>();
    for (const d of details) {
      for (const g of (d?.genres ?? []).slice(0, 5)) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    topGenres = Array.from(counts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  } catch {
    topGenres = [];
  }

  // Longest completed by episode count (duration is per-episode; entries
  // are per-anime so use the provider total when the details are cached).
  let longestCompleted: WatchingStats["longestCompleted"] = null;
  try {
    const provider = getProvider();
    const candidates = completed.slice(0, 6);
    const details = await Promise.all(candidates.map((p) => provider.getAnimeDetails(p.animeId).catch(() => null)));
    for (let i = 0; i < candidates.length; i++) {
      const eps = details[i]?.totalEpisodes ?? details[i]?.episodes ?? candidates[i].episodeNumber;
      if (eps && (!longestCompleted || eps > longestCompleted.episodes)) {
        longestCompleted = { animeId: candidates[i].animeId, title: candidates[i].animeTitle, episodes: eps };
      }
    }
  } catch {
    /* keep null */
  }

  return {
    animeCount: progress.length,
    // One entry per anime → the honest episode count is the sum of the
    // highest episode number reached per anime.
    episodeCount: progress.reduce((sum, p) => sum + Math.max(1, Math.floor(p.episodeNumber) || 1), 0),
    watchHours: Math.round((watchedSeconds / 3600) * 10) / 10,
    completedCount: completed.length,
    watchingCount: watching.length,
    watchlistCount: watchlist.length,
    favoritesCount: favorites.length,
    topGenres,
    recentlyWatched: recent.slice(0, 8).map((p) => ({
      animeId: p.animeId,
      title: p.animeTitle,
      image: p.animeImage,
      episodeNumber: p.episodeNumber,
      updatedAt: p.updatedAt,
    })),
    longestCompleted,
    streakDays: computeStreak(activity),
    generatedAt: new Date().toISOString(),
  };
}

/* ── 60s per-user cache so profile renders never re-aggregate.
   Lives on globalThis: Next bundles lib code per-route, so a plain
   module Map would give each route its own cache and break
   invalidation from the progress route. ── */

const gCache = globalThis as unknown as { __kuroStatsCache?: Map<string, { at: number; value: WatchingStats }> };
const cache = (gCache.__kuroStatsCache ??= new Map());

export async function getWatchingStats(userId: string, store: DataStore): Promise<WatchingStats> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = await computeWatchingStats(userId, store);
  cache.set(userId, { at: Date.now(), value });
  if (cache.size > 500) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return value;
}

export function invalidateStatsCache(userId: string) {
  cache.delete(userId);
}
