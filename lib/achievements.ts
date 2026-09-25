import type { DataStore } from "@/lib/db/store";

/* ────────────────────────────────────────────────────────────────
   ACHIEVEMENTS — verified SERVER-SIDE against real KURO activity.
   The client can only read them; unlocking always happens here.
   ──────────────────────────────────────────────────────────────── */

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** Returns the progress denominator for locked achievements. */
  target: number;
  compute: (ctx: AchievementContext) => number;
}

export interface AchievementContext {
  totalEpisodes: number;
  completedCount: number;
  watchlistCount: number;
  favoritesCount: number;
  /** Distinct days with a watch hour between 23:00–04:59. */
  lateNightDays: number;
  /** Max episodes recorded on a single day. */
  bestDayEpisodes: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-episode", icon: "🥉", title: "First Episode", description: "Watch your first episode.", target: 1, compute: (c) => c.totalEpisodes },
  { id: "getting-started", icon: "🍿", title: "Getting Started", description: "Watch 10 episodes.", target: 10, compute: (c) => c.totalEpisodes },
  { id: "anime-addict", icon: "🔥", title: "Anime Addict", description: "Watch 100 episodes.", target: 100, compute: (c) => c.totalEpisodes },
  { id: "no-life", icon: "💀", title: "No Life", description: "Watch 500 episodes.", target: 500, compute: (c) => c.totalEpisodes },
  { id: "veteran", icon: "👑", title: "Veteran", description: "Reach 1,000 lifetime episodes.", target: 1000, compute: (c) => c.totalEpisodes },
  { id: "completionist", icon: "🗡️", title: "Completionist", description: "Complete 10 anime.", target: 10, compute: (c) => c.completedCount },
  { id: "collector", icon: "📚", title: "Collector", description: "Add 25 anime to your watchlist.", target: 25, compute: (c) => c.watchlistCount },
  { id: "favorite", icon: "❤️", title: "True Love", description: "Favorite your first anime.", target: 1, compute: (c) => c.favoritesCount },
  { id: "night-owl", icon: "🌙", title: "Night Owl", description: "Watch anime late at night on 3 different days.", target: 3, compute: (c) => c.lateNightDays },
  { id: "binge-mode", icon: "⚡", title: "Binge Mode", description: "Watch 5 episodes on a single day.", target: 5, compute: (c) => c.bestDayEpisodes },
];

export interface AchievementView {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
}

function lateNightDaysOf(days: { hours: number[] }[]): number {
  return days.filter((d) => d.hours.some((h) => h >= 23 || h <= 4)).length;
}

async function buildContext(userId: string, store: DataStore): Promise<AchievementContext> {
  const [progress, watchlist, favorites, activity] = await Promise.all([
    store.listProgress(userId),
    store.listWatchlist(userId),
    store.listFavorites(userId),
    store.listActivity(userId, 400).catch(() => []),
  ]);
  return {
    totalEpisodes: progress.length,
    completedCount: progress.filter((p) => p.completed).length,
    watchlistCount: watchlist.length,
    favoritesCount: favorites.length,
    lateNightDays: lateNightDaysOf(activity),
    bestDayEpisodes: activity.reduce((m, d) => Math.max(m, d.episodes), 0),
  };
}

/** Evaluate + persist. Returns the full view plus newly-unlocked ids. */
export async function evaluateAchievements(
  userId: string,
  store: DataStore,
): Promise<{ view: AchievementView[]; newlyUnlocked: AchievementView[] }> {
  const ctx = await buildContext(userId, store);
  const record = await store.getAchievementRecord(userId);
  const prev = record?.unlocked ?? {};
  const now = new Date().toISOString();
  const next: Record<string, string> = { ...prev };
  const newlyUnlocked: AchievementView[] = [];

  const view = ACHIEVEMENTS.map((def) => {
    const value = def.compute(ctx);
    const wasUnlocked = Boolean(prev[def.id]);
    const nowUnlocked = value >= def.target;
    if (nowUnlocked && !wasUnlocked) next[def.id] = now;
    const unlockedAt = next[def.id] ?? null;
    const v: AchievementView = {
      id: def.id,
      icon: def.icon,
      title: def.title,
      description: def.description,
      unlocked: Boolean(unlockedAt),
      unlockedAt,
      progress: Math.min(value, def.target),
      target: def.target,
    };
    if (nowUnlocked && !wasUnlocked) newlyUnlocked.push(v);
    return v;
  });

  // Persist only when something changed.
  if (newlyUnlocked.length) await store.saveAchievementRecord(userId, next);

  return { view, newlyUnlocked };
}
