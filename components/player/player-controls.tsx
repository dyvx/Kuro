"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Settings,
  Subtitles,
  SkipForward,
  LoaderCircle,
  Gauge,
  MonitorPlay,
  Keyboard,
  FastForward,
  Server,
} from "lucide-react";
import { useMediaState, type MediaPlayerInstance } from "@vidstack/react";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/utils/cn";
import { cn } from "@/utils/cn";
import type { PlayerPrefs } from "@/lib/player/player-types";
import type { TimeWindow } from "@/types/anime";

interface ControlsProps {
  mediaRef: RefObject<MediaPlayerInstance | null>;
  prefs: PlayerPrefs;
  updatePrefs: (patch: Partial<PlayerPrefs>) => void;
  phase: string;
  episodeLabel: string;
  animeTitle: string;
  quality?: string;
  sourceType?: string;
  /** Stable id of the active source — resets auto-skip guards on switch. */
  sourceKey?: string | null;
  introWindow?: TimeWindow | null;
  outroWindow?: TimeWindow | null;
  recapWindow?: TimeWindow | null;
  nextHref?: string | null;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerControls({
  mediaRef,
  prefs,
  updatePrefs,
  phase,
  episodeLabel,
  animeTitle,
  quality,
  sourceType,
  sourceKey,
  introWindow,
  outroWindow,
  recapWindow,
  nextHref,
}: ControlsProps) {
  const { toast } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(true);
  const [menu, setMenu] = useState<"none" | "settings" | "quality" | "captions" | "shortcuts">("none");
  const [seekHover, setSeekHover] = useState<number | null>(null);

  // Auto-skip guards — fire once per source until the window changes.
  const autoFired = useRef<{ intro: string | null; outro: string | null }>({
    intro: null,
    outro: null,
  });
  useEffect(() => {
    autoFired.current = { intro: null, outro: null };
  }, [sourceKey]);

  const skipIntroNow = useCallback(() => {
    const p = mediaRef.current;
    if (!p || !introWindow) return;
    p.currentTime = introWindow.end;
    autoFired.current.intro = sourceKey ?? "manual";
  }, [mediaRef, introWindow, sourceKey]);

  const goNextNow = useCallback(() => {
    if (!nextHref) return;
    autoFired.current.outro = sourceKey ?? "manual";
    window.location.assign(nextHref);
  }, [nextHref, sourceKey]);

  const player = mediaRef.current;
  const paused = useMediaState("paused", mediaRef);
  const currentTime = useMediaState("currentTime", mediaRef);
  const duration = useMediaState("duration", mediaRef);
  const bufferedEnd = useMediaState("bufferedEnd", mediaRef);
  const volume = useMediaState("volume", mediaRef);
  const muted = useMediaState("muted", mediaRef);
  const fullscreen = useMediaState("fullscreen", mediaRef);
  const pip = useMediaState("pictureInPicture", mediaRef);
  const waiting = useMediaState("waiting", mediaRef);
  const canPlay = useMediaState("canPlay", mediaRef);
  const textTracks = useMediaState("textTracks", mediaRef);

  // Reactive auto-skip checks (currentTime re-renders this component).
  useEffect(() => {
    if (!canPlay) return;
    const t = currentTime;
    if (
      prefs.autoSkipIntro &&
      introWindow &&
      autoFired.current.intro !== (sourceKey ?? "fired") &&
      t >= introWindow.start &&
      t < introWindow.end - 0.75
    ) {
      autoFired.current.intro = sourceKey ?? "fired";
      const p = mediaRef.current;
      if (p) p.currentTime = introWindow.end;
    }
    if (
      prefs.autoSkipOutro &&
      outroWindow &&
      nextHref &&
      autoFired.current.outro !== (sourceKey ?? "fired") &&
      t >= outroWindow.start
    ) {
      autoFired.current.outro = sourceKey ?? "fired";
      toast("Skipping outro — next episode…", "info", 2200);
      window.location.assign(nextHref);
    }
  }, [currentTime, canPlay, prefs.autoSkipIntro, prefs.autoSkipOutro, introWindow, outroWindow, sourceKey, nextHref, mediaRef]);

  const skipRecapNow = useCallback(() => {
    const p = mediaRef.current;
    if (!p || !recapWindow) return;
    p.currentTime = recapWindow.end;
  }, [mediaRef, recapWindow]);

  const showSkipIntro =
    Boolean(introWindow) &&
    currentTime >= (introWindow?.start ?? 0) &&
    currentTime <= (introWindow?.end ?? 0) - 0.75;
  const showSkipRecap =
    Boolean(recapWindow) &&
    currentTime >= (recapWindow?.start ?? 0) &&
    currentTime <= (recapWindow?.end ?? 0) - 0.75;
  const inOutroWindow =
    Boolean(outroWindow) && currentTime >= (outroWindow?.start ?? Infinity);
  const nearEnd = duration > 0 && currentTime / duration > 0.93;
  const showNext = Boolean(nextHref) && (inOutroWindow || nearEnd);

  const captionTracks = useMemo(
    () =>
      Array.from(textTracks ?? []).filter(
        (t) => (t as { kind?: string }).kind === "subtitles" || (t as { kind?: string }).kind === "captions"
      ) as unknown as { label?: string; language?: string; selected?: boolean }[],
    [textTracks]
  );

  const qualities = (player?.qualities ?? []) as unknown as {
    id: string;
    height?: number;
    bitrate?: number;
    select?: () => void;
  }[];
  const activeQuality = (player?.state?.quality ?? null) as unknown as { id?: string } | null;

  /* ── auto-hide controls ────────────────────────────────────── */

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!paused && menu === "none") setVisible(false);
    }, 3200);
  }, [paused, menu]);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (paused || menu !== "none") setVisible(true);
  }, [paused, menu]);

  useEffect(() => {
    const onMove = () => reveal();
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [reveal]);

  /* ── actions ───────────────────────────────────────────────── */

  const togglePlay = useCallback(() => {
    const p = mediaRef.current;
    if (!p) return;
    if (p.paused) p.play?.().catch(() => {});
    else p.pause?.();
  }, [mediaRef]);

  const seekBy = useCallback(
    (delta: number) => {
      const p = mediaRef.current;
      if (!p) return;
      const target = Math.min(Math.max(0, (p.currentTime ?? 0) + delta), p.duration || Infinity);
      p.currentTime = target;
    },
    [mediaRef]
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const p = mediaRef.current;
      if (!p || !p.duration) return;
      p.currentTime = Math.min(Math.max(0, ratio), 0.999) * p.duration;
    },
    [mediaRef]
  );

  const changeVolume = useCallback(
    (v: number) => {
      const p = mediaRef.current;
      if (!p) return;
      const clamped = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
      p.volume = clamped;
      if (clamped > 0 && p.muted) p.muted = false;
      updatePrefs({ volume: clamped, muted: clamped === 0 });
    },
    [mediaRef, updatePrefs]
  );

  const toggleMute = useCallback(() => {
    const p = mediaRef.current;
    if (!p) return;
    const next = !p.muted;
    p.muted = next;
    updatePrefs({ muted: next });
  }, [mediaRef, updatePrefs]);

  const toggleFullscreen = useCallback(() => {
    const p = mediaRef.current;
    if (!p) return;
    if (p.state?.fullscreen) p.exitFullscreen?.();
    else p.enterFullscreen?.();
  }, [mediaRef]);

  const togglePip = useCallback(async () => {
    const p = mediaRef.current;
    if (!p) return;
    try {
      if (p.state?.pictureInPicture) {
        await p.exitPictureInPicture?.();
        return;
      }
      const video = (p.provider as unknown as { media?: HTMLVideoElement } | null)?.media;
      if (video && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
        await video.requestPictureInPicture();
      }
    } catch {
      /* PiP unavailable */
    }
  }, [mediaRef]);

  const toggleCaptions = useCallback(() => {
    const p = mediaRef.current;
    if (!p) return;
    const anySelected = captionTracks.some((t) => (t as { selected?: boolean }).selected);
    for (const t of captionTracks) {
      (t as { selected?: boolean }).selected = !anySelected;
      updatePrefs({ captionsLang: !anySelected ? t.language ?? null : null });
      break; // vidstack turns the rest off; first track is our demo/en track
    }
    if (anySelected) updatePrefs({ captionsLang: null });
  }, [captionTracks, mediaRef, updatePrefs]);

  const selectCaption = useCallback(
    (lang: string | null) => {
      const p = mediaRef.current;
      if (!p) return;
      for (const t of captionTracks) {
        (t as { selected?: boolean }).selected = lang !== null && t.language === lang;
      }
      updatePrefs({ captionsLang: lang });
    },
    [captionTracks, mediaRef, updatePrefs]
  );

  const setRate = useCallback(
    (rate: number) => {
      if (mediaRef.current) mediaRef.current.playbackRate = rate;
      updatePrefs({ rate });
    },
    [mediaRef, updatePrefs]
  );

  const selectQuality = useCallback(
    (q: { select?: () => void }) => {
      try {
        q.select?.();
      } catch {
        /* provider may not support manual quality */
      }
      setMenu("settings");
    },
    []
  );

  /* ── keyboard shortcuts ────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const p = mediaRef.current;
      if (!p) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          reveal();
          break;
        case "arrowright":
          e.preventDefault();
          seekBy(e.shiftKey ? 10 : 5);
          reveal();
          break;
        case "arrowleft":
          e.preventDefault();
          seekBy(e.shiftKey ? -10 : -5);
          reveal();
          break;
        case "l":
          seekBy(10);
          reveal();
          break;
        case "j":
          seekBy(-10);
          reveal();
          break;
        case "arrowup":
          e.preventDefault();
          changeVolume((p.volume ?? 1) + 0.1);
          reveal();
          break;
        case "arrowdown":
          e.preventDefault();
          changeVolume((p.volume ?? 0) - 0.1);
          reveal();
          break;
        case "m":
          toggleMute();
          reveal();
          break;
        case "s":
          if (introWindow) skipIntroNow();
          reveal();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "p":
          togglePip();
          break;
        case "c":
          toggleCaptions();
          reveal();
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            seekToRatio(Number(e.key) / 10);
            reveal();
          }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    changeVolume,
    introWindow,
    mediaRef,
    reveal,
    seekBy,
    seekToRatio,
    skipIntroNow,
    toggleCaptions,
    toggleFullscreen,
    toggleMute,
    togglePip,
    togglePlay,
  ]);

  /* ── seek bar pointer handling ─────────────────────────────── */

  const barRef = useRef<HTMLDivElement>(null);

  const ratioFromEvent = useCallback((clientX: number) => {
    const el = barRef.current;
    if (!el || !duration) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, [duration]);

  const onBarDown = (e: React.PointerEvent) => {
    e.preventDefault();
    barRef.current?.setPointerCapture(e.pointerId);
    seekToRatio(ratioFromEvent(e.clientX));
  };
  const onBarMove = (e: React.PointerEvent) => {
    const ratio = ratioFromEvent(e.clientX);
    setSeekHover(duration ? ratio * duration : null);
    if (e.buttons === 1) seekToRatio(ratio);
  };
  const onBarUp = (e: React.PointerEvent) => {
    try {
      barRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const bufferedPct = duration ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const playedPct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const showBuffering = (waiting || (!canPlay && phase === "ready")) && phase === "ready";

  return (
    <>
      {/* Skip layer — visible independently of the auto-hiding control bar */}
      {(showSkipIntro || showSkipRecap || showNext) && (
        <div className="absolute bottom-[84px] right-3 z-20 flex flex-col items-end gap-2 sm:right-4 animate-fade-up">
          {showSkipIntro && (
            <button
              onClick={skipIntroNow}
              className="glass-strong group/skip flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white shadow-card transition-all duration-200 ease-premium hover:border-primary-400/60 hover:text-primary-200 active:scale-95"
            >
              Skip Intro
              <FastForward className="h-4 w-4 transition-transform group-hover/skip:translate-x-0.5" aria-hidden />
            </button>
          )}
          {showSkipRecap && !showSkipIntro && (
            <button
              onClick={skipRecapNow}
              className="glass-strong group/skip flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white shadow-card transition-all duration-200 ease-premium hover:border-primary-400/60 hover:text-primary-200 active:scale-95"
            >
              Skip Recap
              <FastForward className="h-4 w-4 transition-transform group-hover/skip:translate-x-0.5" aria-hidden />
            </button>
          )}
          {showNext && (
            <button
              onClick={goNextNow}
              className="group/next flex min-h-[44px] items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-glow transition-all duration-200 ease-premium hover:brightness-110 active:scale-95"
            >
              Next Episode
              <SkipForward className="h-4 w-4 transition-transform group-hover/next:translate-x-0.5" aria-hidden />
            </button>
          )}
        </div>
      )}

    <div
      ref={rootRef}
      className={cn(
        "absolute inset-0 z-10 flex flex-col justify-end transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 [&_*]:pointer-events-none"
      )}
      onDoubleClick={toggleFullscreen}
      role="group"
      aria-label="Video player controls"
    >
      {/* top gradient + title */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute left-4 right-4 top-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/95">{animeTitle}</p>
          <p className="text-xs text-white/60">{episodeLabel}</p>
        </div>
        {quality && (
          <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
            {sourceType === "hls" ? "HLS" : "MP4"} · {quality}
          </span>
        )}
      </div>

      {/* center play / buffering */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {showBuffering ? (
          <LoaderCircle className="h-14 w-14 animate-spin text-white/85" aria-hidden />
        ) : paused && phase === "ready" ? (
          <button
            onClick={togglePlay}
            aria-label="Play"
            className="pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient/90 shadow-glow backdrop-blur-sm transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Play className="ml-1.5 h-9 w-9 fill-white text-white" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* bottom controls */}
      <div className="relative bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-10 sm:px-4 sm:pb-3">
        {/* seek bar */}
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration) || 0}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerLeave={() => setSeekHover(null)}
          className="group/bar relative mx-1 mb-2.5 flex h-6 cursor-pointer items-center"
        >
          <div className="relative h-1.5 w-full rounded-full bg-white/15 transition-all duration-150 group-hover/bar:h-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${bufferedPct}%` }} aria-hidden />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-gradient" style={{ width: `${playedPct}%` }} aria-hidden />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-glow-sm transition-opacity duration-150 group-hover/bar:opacity-100"
              style={{ left: `${playedPct}%` }}
              aria-hidden
            />
          </div>
          {seekHover !== null && (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-lg bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ left: `${duration ? (seekHover / duration) * 100 : 0}%` }}
              aria-hidden
            >
              {formatTime(seekHover)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <CtrlButton label={paused ? "Play (k)" : "Pause (k)"} onClick={togglePlay}>
            {paused ? <Play className="h-5 w-5 fill-current" aria-hidden /> : <Pause className="h-5 w-5 fill-current" aria-hidden />}
          </CtrlButton>

          {nextHref && (
            <CtrlButton label="Next episode (n)" onClick={() => window.location.assign(nextHref)}>
              <SkipForward className="h-5 w-5" aria-hidden />
            </CtrlButton>
          )}

          {/* volume */}
          <div className="group/vol flex items-center">
            <CtrlButton label={muted ? "Unmute (m)" : "Mute (m)"} onClick={toggleMute}>
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" aria-hidden />
              ) : volume < 0.55 ? (
                <Volume1 className="h-5 w-5" aria-hidden />
              ) : (
                <Volume2 className="h-5 w-5" aria-hidden />
              )}
            </CtrlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/20 opacity-0 transition-all duration-300 group-hover/vol:w-16 group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white sm:w-16 sm:opacity-100 sm:group-hover/vol:w-20"
            />
          </div>

          <span className="ml-1 hidden min-[420px]:block select-none text-xs font-semibold tabular-nums text-white/85 sm:text-[13px]">
            {formatTime(currentTime)}
            <span className="text-white/45"> / {formatTime(duration)}</span>
          </span>

          <div className="flex-1" />

          {captionTracks.length > 0 && (
            <CtrlButton
              label="Subtitles (c)"
              active={captionTracks.some((t) => t.selected)}
              onClick={() => setMenu(menu === "captions" ? "none" : "captions")}
            >
              <Subtitles className="h-5 w-5" aria-hidden />
            </CtrlButton>
          )}

          <CtrlButton
            label="Picture in picture (p)"
            active={pip}
            onClick={togglePip}
            className="hidden sm:flex"
          >
            <PictureInPicture2 className="h-5 w-5" aria-hidden />
          </CtrlButton>

          <CtrlButton
            label="Settings"
            active={menu === "settings" || menu === "quality"}
            onClick={() => setMenu(menu === "settings" ? "none" : "settings")}
          >
            <Settings className={cn("h-5 w-5", menu !== "none" && menu !== "shortcuts" && "rotate-45 transition-transform duration-300")} aria-hidden />
          </CtrlButton>

          <CtrlButton label="Keyboard shortcuts" onClick={() => setMenu(menu === "shortcuts" ? "none" : "shortcuts")} className="hidden md:flex">
            <Keyboard className="h-5 w-5" aria-hidden />
          </CtrlButton>

          <CtrlButton label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"} onClick={toggleFullscreen} active={fullscreen}>
            {fullscreen ? <Minimize className="h-5 w-5" aria-hidden /> : <Maximize className="h-5 w-5" aria-hidden />}
          </CtrlButton>
        </div>
      </div>

      {/* menus */}
      {menu === "settings" && (
        <SettingsMenu
          onClose={() => setMenu("none")}
          rate={prefs.rate}
          onRate={setRate}
          autoplayNext={prefs.autoplayNext}
          onAutoplay={(v) => updatePrefs({ autoplayNext: v })}
          autoSkipIntro={prefs.autoSkipIntro}
          onAutoSkipIntro={(v) => updatePrefs({ autoSkipIntro: v })}
          autoSkipOutro={prefs.autoSkipOutro}
          onAutoSkipOutro={(v) => updatePrefs({ autoSkipOutro: v })}
          autoTryNextServer={prefs.autoTryNextServer}
          onAutoTryNextServer={(v) => updatePrefs({ autoTryNextServer: v })}
          qualities={qualities}
          activeQualityId={activeQuality?.id}
          onQuality={selectQuality}
        />
      )}
      {menu === "captions" && (
        <PopMenu title="Subtitles" onClose={() => setMenu("none")}>
          <MenuRow
            label="Off"
            active={prefs.captionsLang === null || !captionTracks.some((t) => t.selected)}
            onClick={() => selectCaption(null)}
          />
          {captionTracks.map((t, i) => (
            <MenuRow
              key={i}
              label={`${t.label ?? "Track"} (${t.language ?? "?"})`}
              active={Boolean(t.selected)}
              onClick={() => selectCaption(t.language ?? null)}
            />
          ))}
        </PopMenu>
      )}
      {menu === "shortcuts" && (
        <PopMenu title="Keyboard shortcuts" onClose={() => setMenu("none")} wide>
          {[
            ["Play / Pause", "K or Space"],
            ["Seek ±5s", "← / →"],
            ["Seek ±10s", "J / L"],
            ["Volume", "↑ / ↓"],
            ["Mute", "M"],
            ["Fullscreen", "F"],
            ["Picture-in-picture", "P"],
            ["Subtitles", "C"],
            ["Seek to %", "0–9"],
          ].map(([action, keys]) => (
            <div key={action} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-txt-muted">{action}</span>
              <kbd className="rounded-md border border-line bg-white/5 px-2 py-0.5 text-xs font-semibold text-txt">{keys}</kbd>
            </div>
          ))}
        </PopMenu>
      )}
    </div>
    </>
  );
}

function CtrlButton({
  label,
  onClick,
  children,
  active,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl text-white/85 transition-all duration-200 hover:bg-white/12 hover:text-white active:scale-90 sm:h-9 sm:w-9",
        active && "text-primary-300",
        className
      )}
    >
      {children}
    </button>
  );
}

function PopMenu({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="absolute bottom-20 right-3 sm:right-4" role="menu" aria-label={title}>
      <div
        className={cn(
          "glass-strong max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl shadow-card-lg animate-scale-in",
          wide ? "w-72" : "w-56"
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-txt-muted">{title}</p>
          <button onClick={onClose} aria-label={`Close ${title} menu`} className="text-txt-faint hover:text-txt">
            <Settings className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">{children}</div>
      </div>
    </div>
  );
}

function MenuRow({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        active ? "bg-primary-500/15 font-semibold text-primary-200" : "text-txt-muted hover:bg-white/5 hover:text-txt"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SettingsMenu({
  onClose,
  rate,
  onRate,
  autoplayNext,
  onAutoplay,
  autoSkipIntro,
  onAutoSkipIntro,
  autoSkipOutro,
  onAutoSkipOutro,
  autoTryNextServer,
  onAutoTryNextServer,
  qualities,
  activeQualityId,
  onQuality,
}: {
  onClose: () => void;
  rate: number;
  onRate: (r: number) => void;
  autoplayNext: boolean;
  onAutoplay: (v: boolean) => void;
  autoSkipIntro: boolean;
  onAutoSkipIntro: (v: boolean) => void;
  autoSkipOutro: boolean;
  onAutoSkipOutro: (v: boolean) => void;
  autoTryNextServer: boolean;
  onAutoTryNextServer: (v: boolean) => void;
  qualities: { id: string; height?: number; bitrate?: number; select?: () => void }[];
  activeQualityId?: string;
  onQuality: (q: { select?: () => void }) => void;
}) {
  return (
    <PopMenu title="Settings" onClose={onClose}>
      <div className="px-3 pb-1 pt-1.5">
        <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-faint">
          <Gauge className="h-3.5 w-3.5" aria-hidden /> Speed
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => onRate(r)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                rate === r
                  ? "border-primary-400/60 bg-primary-500/15 text-primary-200"
                  : "border-line text-txt-muted hover:border-line-strong hover:text-txt"
              )}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>

      {qualities.length > 1 && (
        <div className="border-t border-line px-3 pb-1 pt-2.5">
          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-faint">
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> Quality
          </p>
          <div className="flex flex-wrap gap-1.5">
            {qualities
              .slice()
              .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
              .map((q) => (
                <button
                  key={q.id}
                  onClick={() => onQuality(q)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                    activeQualityId === q.id
                      ? "border-primary-400/60 bg-primary-500/15 text-primary-200"
                      : "border-line text-txt-muted hover:border-line-strong hover:text-txt"
                  )}
                >
                  {q.height ? `${q.height}p` : q.id}
                </button>
              ))}
          </div>
        </div>
      )}

      <label className="mt-2.5 flex cursor-pointer items-center justify-between border-t border-line px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-txt">
          <SkipForward className="h-4 w-4 text-primary-300" aria-hidden />
          Autoplay next episode
        </span>
        <input
          type="checkbox"
          checked={autoplayNext}
          onChange={(e) => onAutoplay(e.target.checked)}
          className="h-4 w-4 accent-[#8b5cf6]"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-txt">
          <FastForward className="h-4 w-4 text-primary-300" aria-hidden />
          Auto-skip intro
        </span>
        <input
          type="checkbox"
          checked={autoSkipIntro}
          onChange={(e) => onAutoSkipIntro(e.target.checked)}
          className="h-4 w-4 accent-[#8b5cf6]"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between px-3 pb-1">
        <span className="flex items-center gap-2 text-sm text-txt">
          <FastForward className="h-4 w-4 text-primary-300" aria-hidden />
          Auto-skip outro
        </span>
        <input
          type="checkbox"
          checked={autoSkipOutro}
          onChange={(e) => onAutoSkipOutro(e.target.checked)}
          className="h-4 w-4 accent-[#8b5cf6]"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between border-t border-line px-3 py-2.5">
        <span className="flex items-center gap-2 pr-2 text-sm text-txt">
          <Server className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />
          Auto-try next server on failure
        </span>
        <input
          type="checkbox"
          checked={autoTryNextServer}
          onChange={(e) => onAutoTryNextServer(e.target.checked)}
          className="h-4 w-4 accent-[#8b5cf6]"
        />
      </label>
    </PopMenu>
  );
}
