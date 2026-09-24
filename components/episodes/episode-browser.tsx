"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ListFilter, Search, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import type { EpisodeListItem, SeasonInfo } from "@/types/anime";

interface Props {
  animeId: string;
  animeTitle: string;
  seasons: SeasonInfo[];
  episodes: EpisodeListItem[];
}

const CHUNK = 50;

/**
 * Episode browser — search, season selector, watched indicators and
 * chunked pagination so long-running shows never render thousands of
 * DOM nodes at once.
 */
export function EpisodeBrowser({ animeId, episodes, seasons }: Props) {
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState(seasons[0]?.id ?? "1");
  const [visible, setVisible] = useState(CHUNK);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [resumeEp, setResumeEp] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/progress?animeId=${encodeURIComponent(animeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = json?.progress;
        if (!p) return;
        const seen = new Set<number>();
        for (const w of p) seen.add(Number(w.episodeNumber));
        setWatched(seen);
        if (!p.completed && p.episodeNumber) setResumeEp(Number(p.episodeNumber));
      })
      .catch(() => {});
  }, [animeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(
      (e) => String(e.number).includes(q) || (e.title ?? "").toLowerCase().includes(q)
    );
  }, [episodes, query]);

  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-txt sm:text-2xl">
          Episodes <span className="ml-1 align-middle text-sm font-medium text-txt-faint">{episodes.length}</span>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-faint" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(CHUNK);
            }}
            placeholder="Search episodes…"
            aria-label="Search episodes"
            className="pl-9"
          />
        </div>
      </div>

      {seasons.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeason(s.id)}
              className={cn(
                "shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition-all",
                season === s.id
                  ? "border-primary-400/60 bg-primary-500/15 text-primary-200"
                  : "border-line text-txt-muted hover:border-line-strong hover:text-txt"
              )}
            >
              {s.name}
              <ListFilter className="ml-1.5 inline h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      )}

      <ol className="overflow-hidden rounded-2xl border border-line">
        {shown.map((ep) => {
          const isWatched = watched.has(ep.number);
          const isResume = resumeEp === ep.number && !isWatched;
          const href = `/watch/${animeId}/${ep.id}`;
          return (
            <li key={ep.id} className="border-b border-line last:border-b-0">
              <Link
                href={href}
                className={cn(
                  "group flex items-center gap-4 px-4 py-3.5 transition-colors duration-200",
                  isResume ? "bg-primary-500/[0.08]" : "hover:bg-white/[0.035]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors",
                    isResume
                      ? "bg-brand-gradient text-white shadow-glow-sm"
                      : isWatched
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/[0.05] text-txt-muted group-hover:bg-primary-500/20 group-hover:text-primary-200"
                  )}
                  aria-hidden
                >
                  {isWatched ? <Check className="h-4 w-4" /> : isResume ? <Play className="h-4 w-4 fill-white" /> : ep.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-txt">
                    {ep.title ? `Episode ${ep.number} · ${ep.title}` : `Episode ${ep.number}`}
                  </span>
                  {ep.filler && (
                    <span className="mt-0.5 inline-block rounded border border-amber-400/40 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Filler
                    </span>
                  )}
                </span>
                {ep.duration && (
                  <span className="shrink-0 text-xs text-txt-faint">{ep.duration} min</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {filtered.length > shown.length && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setVisible((v) => v + CHUNK * 2)}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
          >
            Show more episodes
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-xs text-txt-faint">
            {shown.length} of {filtered.length}
          </span>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-txt-muted">
          No episodes match “{query}”.
        </p>
      )}
    </div>
  );
}
