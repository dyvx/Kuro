"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Play, Search, RotateCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WatchlistButton } from "@/components/anime/watchlist-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { EpisodeBundle, EpisodeListItem } from "@/types/anime";

interface Props {
  animeId: string;
  currentEpisodeId: string;
  /** Pre-loaded bundle (fast providers) — skips the client fetch. */
  initialBundle?: EpisodeBundle;
}

const CHUNK = 60;

/**
 * Watch-page episode panel. Fetches its own bundle client-side (with
 * skeleton + retry) so the watch page renders instantly even when the
 * provider's episode list is still being scraped.
 */
export function EpisodePanel({ animeId, currentEpisodeId, initialBundle }: Props) {
  const router = useRouter();
  const [bundle, setBundle] = useState<EpisodeBundle | null>(initialBundle ?? null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(
    initialBundle ? "ready" : "loading"
  );
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(CHUNK);
  const [watched, setWatched] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialBundle) return;
    let cancelled = false;
    fetch(`/api/anime/episodes?id=${encodeURIComponent(animeId)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Failed");
        return json as EpisodeBundle;
      })
      .then((json) => {
        if (cancelled) return;
        setBundle(json);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [animeId, attempt, initialBundle]);

  useEffect(() => {
    fetch(`/api/progress?animeId=${encodeURIComponent(animeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = json?.progress;
        if (!p) return;
        if (Array.isArray(p)) {
          setWatched(new Set(p.map((w: { episodeId: string }) => w.episodeId)));
        }
      })
      .catch(() => {});
  }, [animeId]);

  const episodes = bundle?.episodes ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (e) => String(e.number).includes(q) || (e.title ?? "").toLowerCase().includes(q)
    );
  }, [episodes, query]);

  const shown = filtered.slice(0, visible);
  const currentIndex = episodes.findIndex((e) => e.id === currentEpisodeId);
  const prev = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

  return (
    <div className="border-line px-4 py-4 md:rounded-3xl md:border md:bg-surface/60 md:px-4 xl:sticky xl:top-20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-txt">
          Episodes
          {phase === "ready" && episodes.length > 0 && (
            <span className="text-sm font-medium text-txt-faint"> {episodes.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-1.5">
          <NavButton
            label="Previous episode"
            disabled={!prev}
            onClick={() => prev && router.push(`/watch/${animeId}/${prev.id}`)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </NavButton>
          <NavButton
            label="Next episode"
            disabled={!next}
            onClick={() => next && router.push(`/watch/${animeId}/${next.id}`)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </NavButton>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-faint" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(CHUNK);
          }}
          placeholder="Find episode…"
          aria-label="Find episode"
          disabled={phase !== "ready"}
          className="h-10 pl-9"
        />
      </div>

      <WatchlistButton
        anime={{ id: animeId, title: "" }}
        className="mb-3 h-10 w-full rounded-xl border-line bg-white/[0.03] text-sm text-txt-muted hover:bg-white/[0.06] hover:text-txt"
      />

      {phase === "loading" && (
        <div aria-hidden className="space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
          <p className="pt-2 text-center text-xs text-txt-faint">Loading episode list…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-2xl border border-crimson-500/20 bg-crimson-500/[0.04] p-4 text-center">
          <p className="text-sm text-txt-muted">The episode list failed to load.</p>
          <button
            onClick={() => {
              setPhase("loading");
              setAttempt((a) => a + 1);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {phase === "ready" && episodes.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-txt-muted">
          No episodes available for this title yet.
        </p>
      )}

      {phase === "ready" && episodes.length > 0 && (
        <>
          <ol className="scrollbar-none max-h-[420px] space-y-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-340px)]">
            {shown.map((ep) => (
              <EpisodeRow
                key={ep.id}
                ep={ep}
                animeId={animeId}
                isCurrent={ep.id === currentEpisodeId}
                isWatched={watched.has(ep.id)}
              />
            ))}
          </ol>

          {filtered.length > shown.length && (
            <button
              onClick={() => setVisible((v) => v + CHUNK)}
              className="mt-3 w-full rounded-xl border border-line py-2.5 text-xs font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
            >
              Show more ({filtered.length - shown.length} remaining)
            </button>
          )}
          {currentIndex >= 0 && (
            <p className="mt-3 text-center text-[11px] text-txt-faint">
              Episode {currentIndex + 1} of {episodes.length}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function EpisodeRow({
  ep,
  animeId,
  isCurrent,
  isWatched,
}: {
  ep: EpisodeListItem;
  animeId: string;
  isCurrent: boolean;
  isWatched: boolean;
}) {
  return (
    <li>
      <Link
        href={`/watch/${animeId}/${ep.id}`}
        aria-current={isCurrent ? "true" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200",
          isCurrent
            ? "border-primary-400/60 bg-primary-500/15 text-primary-100 shadow-glow-sm"
            : "border-transparent text-txt-muted hover:border-line hover:bg-white/[0.04] hover:text-txt"
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            isCurrent
              ? "bg-brand-gradient text-white"
              : isWatched
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-white/[0.06] text-txt-muted"
          )}
          aria-hidden
        >
          {isWatched ? <Check className="h-3.5 w-3.5" /> : isCurrent ? <Play className="h-3 w-3 fill-white" /> : ep.number}
        </span>
        <span className="line-clamp-1 min-w-0 flex-1">
          {ep.title ? `Episode ${ep.number} · ${ep.title}` : `Episode ${ep.number}`}
        </span>
        {ep.filler && (
          <span className="shrink-0 rounded border border-amber-400/40 px-1 text-[9px] font-bold uppercase text-amber-300">
            F
          </span>
        )}
      </Link>
    </li>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-txt-muted transition-all hover:border-primary-400/50 hover:text-primary-200 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
