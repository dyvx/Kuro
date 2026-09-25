"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HLS from "hls.js";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  isHLSProvider,
  type MediaErrorDetail,
  type MediaProviderAdapter,
  type MediaPlayerInstance,
} from "@vidstack/react";
import { AlertTriangle, LoaderCircle, RotateCw } from "lucide-react";
import { PlayerControls } from "./player-controls";
import { ServerSwitcher } from "./server-switcher";
import { SourceManager } from "@/lib/player/source-manager";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type PlayerPrefs } from "@/lib/player/player-types";
import { useToast } from "@/components/ui/toast";
import { useSession } from "next-auth/react";
import { formatTime } from "@/utils/cn";
import type { EpisodeServer, VideoSource } from "@/types/anime";

type Phase = "loading-servers" | "loading-source" | "ready" | "failed" | "empty";

interface Props {
  providerId: string;
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string | null;
  nextHref?: string | null;
}

/**
 * Player orchestrator — owns server selection, the source lifecycle and
 * playback-state preservation. Exactly ONE MediaPlayer instance exists;
 * switching servers swaps its `src` cleanly (no page reloads, never a
 * second player). Failures never auto-switch — the user picks the next
 * server manually.
 */
export function PlayerShell(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { status: authStatus } = useSession();

  const manager = useMemo(
    () => new SourceManager(props.providerId, props.animeId),
    [props.providerId, props.animeId]
  );

  const mediaRef = useRef<MediaPlayerInstance | null>(null);

  const [servers, setServers] = useState<EpisodeServer[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [source, setSource] = useState<VideoSource | null>(null);
  const [phase, setPhase] = useState<Phase>("loading-servers");
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULT_PREFS);

  // Pending hand-off across a server switch / resume.
  const pendingSeek = useRef<number | null>(null);
  const pendingPlay = useRef(false);
  const resumedForEpisode = useRef(false);
  const savedPosition = useRef(0);
  const prefsRef = useRef(DEFAULT_PREFS);
  prefsRef.current = prefs;

  /* ── progress: resume + periodic save ──────────────────────── */

  const progressPayload = useCallback(
    (position: number, duration: number) => ({
      animeId: props.animeId,
      animeTitle: props.animeTitle,
      animeImage: props.animeImage,
      episodeId: props.episodeId,
      episodeNumber: props.episodeNumber,
      episodeTitle: props.episodeTitle,
      position: Math.floor(position),
      duration: Math.floor(duration),
    }),
    [props]
  );

  const saveProgress = useCallback(
    (beacon = false) => {
      const player = mediaRef.current;
      if (!player || authStatus !== "authenticated") return;
      const position = Number(player.currentTime ?? 0);
      const duration = Number(player.duration ?? 0);
      if (!duration || Number.isNaN(position) || position < 3) return;
      const body = JSON.stringify(progressPayload(position, duration));
      if (beacon && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/progress", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [authStatus, progressPayload]
  );

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    fetch(`/api/progress?animeId=${encodeURIComponent(props.animeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const p = json?.progress;
        if (p && p.episodeId === props.episodeId && !p.completed && p.position > 20) {
          savedPosition.current = p.position;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus, props.animeId, props.episodeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const player = mediaRef.current;
      if (player && !player.paused && player.state.started) saveProgress();
    }, 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") saveProgress(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      saveProgress(true);
    };
  }, [saveProgress]);

  /* ── prefs persistence ─────────────────────────────────────── */

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const updatePrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  /* ── server/source lifecycle ───────────────────────────────── */

  const markFailed = useCallback(
    (serverId: string) => {
      manager.markFailed(serverId);
      setFailedIds((prev) => new Set(prev).add(serverId));
    },
    [manager]
  );

  const loadServer = useCallback(
    async (serverId: string, opts: { keepPosition?: boolean } = {}) => {
      if (opts.keepPosition) {
        const player = mediaRef.current;
        if (player && Number.isFinite(player.currentTime) && player.currentTime > 1) {
          pendingSeek.current = player.currentTime;
          pendingPlay.current = !player.paused;
          player.pause?.();
        }
      }
      setActiveServerId(serverId);
      setMediaError(null);
      setPhase("loading-source");
      try {
        const sources = await manager.getSources(props.episodeId, serverId);
        const first = sources[0] ?? null;
        if (!first) throw new Error("no direct source");
        setSource(first);
        manager.rememberPreferredServer(serverId);
      } catch {
        // Spec §4 — detect failure, stop spinner, show overlay + toast,
        // do NOT auto-switch. Wait for a manual server click.
        markFailed(serverId);
        setPhase("failed");
        toast("Server failed. Please choose another.", "error");
      }
    },
    [manager, markFailed, props.episodeId, toast]
  );

  // Resolve servers whenever the episode changes.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading-servers");
    setSource(null);
    setActiveServerId(null);
    resumedForEpisode.current = false;
    savedPosition.current = 0;

    (async () => {
      try {
        const list = await manager.getServers(props.episodeId);
        if (cancelled) return;
        setServers(list);
        if (!list.length) {
          setPhase("empty");
          return;
        }
        const preferred = manager.pickInitialServer(list);
        if (!preferred) {
          setPhase("empty");
          return;
        }
        await loadServer(preferred.id);
      } catch {
        if (!cancelled) {
          setServers([]);
          setPhase("empty");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.episodeId, reloadKey]);

  /* ── player events ─────────────────────────────────────────── */

  const onProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
    if (isHLSProvider(provider)) {
      provider.library = HLS;
    }
  }, []);

  const onCanPlay = useCallback(() => {
    setPhase((p) => (p === "failed" ? p : "ready"));
    const player = mediaRef.current;
    if (!player) return;

    // Restore user prefs onto the fresh media.
    try {
      const p = prefsRef.current;
      player.volume = p.volume;
      player.muted = p.muted;
      player.playbackRate = p.rate;
      if (p.captionsLang) {
        for (const t of Array.from(player.textTracks ?? [])) {
          const tt = t as { kind?: string; language?: string; selected?: boolean };
          if ((tt.kind === "subtitles" || tt.kind === "captions") && tt.language === p.captionsLang) {
            tt.selected = true;
            break;
          }
        }
      }
    } catch {
      /* non-fatal */
    }

    // Seek toward the preserved timestamp (resume or server switch).
    const target = pendingSeek.current ?? (resumedForEpisode.current ? null : savedPosition.current);
    if (target && target > 1 && (!player.duration || target < player.duration - 5)) {
      try {
        player.currentTime = target;
      } catch {
        /* non-fatal */
      }
      if (pendingSeek.current === null) {
        toast(`Resumed from ${formatTime(target)}`, "info");
      }
      pendingSeek.current = null;
      if (pendingPlay.current) {
        player.play?.().catch(() => {});
        pendingPlay.current = false;
      }
    }
    resumedForEpisode.current = true;
  }, [toast]);

  const onPlaying = useCallback(() => {
    if (activeServerId) manager.markSuccess(activeServerId);
    setPhase((p) => (p === "failed" ? p : "ready"));
  }, [activeServerId, manager]);

  const onMediaError = useCallback(
    (detail: MediaErrorDetail | null) => {
      if (!activeServerId) return;
      // Spec §4 — playback failure: mark server, overlay + toast, no auto-switch.
      markFailed(activeServerId);
      setPhase("failed");
      setMediaError(detail?.message || "The stream failed to load.");
      toast("Server failed. Please choose another.", "error");
    },
    [activeServerId, markFailed, toast]
  );

  const onEnded = useCallback(() => {
    saveProgress();
    if (prefs.autoplayNext && props.nextHref) {
      toast("Playing next episode…", "success", 2500);
      router.push(props.nextHref);
    }
  }, [prefs.autoplayNext, props.nextHref, router, saveProgress, toast]);

  const reportBroken = useCallback(async () => {
    if (!activeServerId) return;
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          animeId: props.animeId,
          episodeId: props.episodeId,
          serverId: activeServerId,
        }),
      });
      toast("Reported — thank you. Try another server meanwhile.", "success");
    } catch {
      toast("Could not submit the report.", "error");
    }
  }, [activeServerId, props.animeId, props.episodeId, toast]);

  const src = useMemo(() => {
    if (!source) return undefined;
    return {
      src: source.url,
      type: source.type === "hls" ? ("application/x-mpegurl" as const) : ("video/mp4" as const),
    };
  }, [source]);

  return (
    <div>
      {/* Single player instance — src swaps cleanly on server change */}
      <div className="relative aspect-video w-full overflow-hidden bg-black md:rounded-3xl md:border md:border-line md:shadow-card-lg">
        {src && (
          <MediaPlayer
            ref={mediaRef}
            title={`${props.animeTitle} — Episode ${props.episodeNumber}`}
            src={src}
            playsInline
            load="eager"
            streamType="on-demand"
            viewType="video"
            onProviderChange={onProviderChange}
            onCanPlay={onCanPlay}
            onPlaying={onPlaying}
            onError={() => {
              const detail: MediaErrorDetail | null = mediaRef.current?.state?.error ?? null;
              onMediaError(detail);
            }}
            onEnded={onEnded}
          >
            <MediaProvider>
              {source?.subtitles?.map((t) => (
                <Track key={t.id} src={t.url} kind={t.kind} label={t.label} lang={t.language} default={t.language === prefs.captionsLang} />
              ))}
            </MediaProvider>
          </MediaPlayer>
        )}

        <PlayerControls
          mediaRef={mediaRef}
          prefs={prefs}
          updatePrefs={updatePrefs}
          phase={phase}
          episodeLabel={`Episode ${props.episodeNumber}`}
          animeTitle={props.animeTitle}
          quality={source?.quality}
          sourceType={source?.type}
          sourceKey={source?.id ?? null}
          introWindow={source?.intro ?? null}
          outroWindow={source?.outro ?? null}
          nextHref={props.nextHref}
        />

        {phase === "failed" && (
          <div
            role="alert"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center backdrop-blur-sm animate-fade-in"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-crimson-500/40 bg-crimson-500/10">
              <AlertTriangle className="h-7 w-7 text-crimson-400" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">
                This server is currently unavailable.
              </p>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-txt-muted">
                Please select another server below.
                {mediaError ? <span className="block text-xs text-txt-faint">{mediaError}</span> : null}
              </p>
            </div>
          </div>
        )}

        {(phase === "loading-servers" || phase === "loading-source") && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink-950/90">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary-400" aria-hidden />
            <p className="text-sm font-medium text-txt-muted">
              {phase === "loading-servers" ? "Finding available servers…" : "Connecting to server…"}
            </p>
          </div>
        )}

        {phase === "empty" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink-950/95 px-6 text-center">
            <p className="font-display text-lg font-bold text-white">No servers responded</p>
            <p className="max-w-sm text-sm leading-relaxed text-txt-muted">
              The provider didn&apos;t return playable sources for this episode — it may still be
              scraping this title, or every server is down right now.
            </p>
            <button
              onClick={() => {
                setFailedIds(new Set());
                manager.clearFailures();
                setReloadKey((k) => k + 1);
              }}
              className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-5 text-sm font-bold text-white shadow-glow-sm transition-all hover:shadow-glow active:scale-95"
            >
              <RotateCw className="h-4 w-4" aria-hidden />
              Retry servers
            </button>
          </div>
        )}
      </div>

      {/* Server switcher directly beneath the player */}
      <div className="px-4 pt-3 md:px-0">
        <ServerSwitcher
          servers={servers}
          activeServerId={activeServerId}
          failedIds={failedIds}
          disabled={phase === "loading-servers"}
          onSelect={(id) => {
            if (id !== activeServerId) loadServer(id, { keepPosition: true });
          }}
        />
        {activeServerId && (
          <button
            onClick={reportBroken}
            className="mt-2.5 text-xs font-semibold text-txt-faint underline-offset-4 transition-colors hover:text-crimson-400 hover:underline"
          >
            Report broken source
          </button>
        )}
      </div>
    </div>
  );
}

// Rendered above via JSX inside MediaProvider.
