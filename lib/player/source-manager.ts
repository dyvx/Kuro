import type { EpisodeServer, VideoSource } from "@/types/anime";
import {
  type SourceHealth,
  preferredServerKey,
} from "./player-types";

/* ────────────────────────────────────────────────────────────────
   SOURCE MANAGER
   Owns everything that is NOT the player UI:
   • fetching + normalizing servers/sources (via API routes)
   • preferred-server persistence (localStorage)
   • session-scoped failure tracking (NO permanent blacklisting)
   It never touches the DOM or the player instance.
   ──────────────────────────────────────────────────────────────── */

export class SourceManager {
  private provider: string;
  private animeId: string;
  private health: SourceHealth = { failures: {}, successes: {}, lastSuccessfulServer: null };

  constructor(provider: string, animeId: string) {
    this.provider = provider;
    this.animeId = animeId;
  }

  /** Playable servers only — embed-only servers are omitted from the UI. */
  async getServers(episodeId: string): Promise<EpisodeServer[]> {
    const res = await fetch(
      `/api/anime/servers?episodeId=${encodeURIComponent(episodeId)}&animeId=${encodeURIComponent(this.animeId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Failed to fetch servers (${res.status})`);
    const json = await res.json();
    const servers: EpisodeServer[] = Array.isArray(json.servers) ? json.servers : [];
    return servers.filter((s) => !s.embedOnly);
  }

  async getSources(episodeId: string, serverId: string): Promise<VideoSource[]> {
    const res = await fetch(
      `/api/anime/sources?episodeId=${encodeURIComponent(episodeId)}&serverId=${encodeURIComponent(serverId)}&animeId=${encodeURIComponent(this.animeId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Failed to fetch sources (${res.status})`);
    }
    const json = await res.json();
    const sources: VideoSource[] = Array.isArray(json.sources) ? json.sources : [];
    return sources;
  }

  /* ── preferred server ─────────────────────────────────────── */

  getPreferredServerId(available: EpisodeServer[]): string | null {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(preferredServerKey(this.provider, this.animeId));
    if (!saved) return null;
    const exists = available.some((s) => s.id === saved && !s.embedOnly);
    // Spec: if the preferred server no longer exists, fall through.
    return exists ? saved : null;
  }

  rememberPreferredServer(serverId: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(preferredServerKey(this.provider, this.animeId), serverId);
    } catch {
      /* non-fatal */
    }
  }

  /** Preferred → else first available that has not failed this session. */
  pickInitialServer(available: EpisodeServer[]): EpisodeServer | null {
    if (!available.length) return null;
    const preferred = this.getPreferredServerId(available);
    if (preferred && !this.health.failures[preferred]) {
      return available.find((s) => s.id === preferred) ?? null;
    }
    return available.find((s) => !this.health.failures[s.id]) ?? null;
  }

  /* ── session source health (manual-only handling) ─────────── */

  markFailed(serverId: string) {
    this.health.failures[serverId] = (this.health.failures[serverId] ?? 0) + 1;
  }

  markSuccess(serverId: string) {
    this.health.successes[serverId] = (this.health.successes[serverId] ?? 0) + 1;
    this.health.lastSuccessfulServer = serverId;
    // A success softens (but never erases within the attempt) failure marks.
  }

  hasFailed(serverId: string): boolean {
    return (this.health.failures[serverId] ?? 0) > 0;
  }

  failureCount(serverId: string): number {
    return this.health.failures[serverId] ?? 0;
  }

  getLastSuccessfulServer(): string | null {
    return this.health.lastSuccessfulServer;
  }

  clearFailures() {
    this.health.failures = {};
  }
}
