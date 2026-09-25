import type { EpisodeServer, VideoSource } from "@/types/anime";

export type SourceStatus =
  | "idle"
  | "loading-servers"
  | "loading-source"
  | "ready"
  | "failed";

export interface PlayerPrefs {
  volume: number;
  muted: boolean;
  rate: number;
  captionsLang: string | null;
  autoplayNext: boolean;
  /** Jump past the opening theme automatically. */
  autoSkipIntro: boolean;
  /** Trigger next episode when the ending theme starts. */
  autoSkipOutro: boolean;
  /** Opt-in: on server failure, automatically try the next server once. */
  autoTryNextServer: boolean;
}

export const DEFAULT_PREFS: PlayerPrefs = {
  volume: 1,
  muted: false,
  rate: 1,
  captionsLang: null,
  autoplayNext: true,
  autoSkipIntro: true,
  autoSkipOutro: true,
  autoTryNextServer: false,
};

export function preferredServerKey(provider: string, animeId: string): string {
  return `preferredServer:${provider}:${animeId}`;
}

export function playerPrefsKey(): string {
  return "kuro:player-prefs";
}

export function loadPrefs(): PlayerPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(playerPrefsKey());
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PlayerPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: PlayerPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(playerPrefsKey(), JSON.stringify(prefs));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Session-scoped source health log (manual-failure tracking only). */
export interface SourceHealth {
  failures: Record<string, number>; // serverId -> failure count
  successes: Record<string, number>; // serverId -> success count
  lastSuccessfulServer: string | null;
}

export type { EpisodeServer, VideoSource };
