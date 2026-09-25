"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Star, Clapperboard } from "lucide-react";
import type { AnimeResult } from "@/lib/ai/types";

const STATUS_LABEL: Record<string, string> = {
  RELEASING: "Airing",
  FINISHED: "Completed",
  UPCOMING: "Upcoming",
  HIATUS: "Hiatus",
  CANCELLED: "Cancelled",
};

/**
 * Real KURO anime card, rendered from server-resolved catalog data.
 * Play routes through the platform's normal /watch fast path;
 * View Anime opens the existing details page. No external links.
 */
export function AnimeResultCard({ anime }: { anime: AnimeResult }) {
  const ep = anime.resumeEpisode && anime.resumeEpisode > 0 ? anime.resumeEpisode : 1;
  const watchHref = `/watch/${anime.id}/ep-${ep}`;

  return (
    <div className="group flex w-full gap-3.5 rounded-2xl border border-line bg-surface/70 p-3 transition-all duration-300 ease-premium hover:border-primary-400/40 hover:bg-surface-raised sm:gap-4">
      <Link
        href={`/anime/${anime.id}`}
        aria-label={`View ${anime.title}`}
        className="relative h-[104px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-ink-800 sm:h-[120px] sm:w-[82px]"
      >
        {anime.thumbnail ? (
          <Image src={anime.thumbnail} alt="" fill sizes="82px" className="object-cover" unoptimized />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-txt-faint" aria-hidden />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/anime/${anime.id}`} className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-bold text-txt transition-colors group-hover:text-primary-200 sm:text-[15px]">
            {anime.title}
          </h3>
          {anime.japaneseTitle && (
            <p className="line-clamp-1 text-[11px] text-txt-faint">{anime.japaneseTitle}</p>
          )}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-txt-muted">
          {anime.rating != null && (
            <span className="flex items-center gap-1 font-bold text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" aria-hidden />
              {anime.rating.toFixed(1)}
            </span>
          )}
          {anime.year != null && <span>{anime.year}</span>}
          {anime.episodes != null && <span>{anime.episodes} ep{anime.episodes === 1 ? "" : "s"}</span>}
          {anime.type && <span className="uppercase">{anime.type}</span>}
          {anime.status && <span className="text-txt-faint">{STATUS_LABEL[anime.status] ?? anime.status}</span>}
        </div>

        {anime.description && (
          <p className="mt-1.5 line-clamp-2 hidden text-xs leading-relaxed text-txt-faint sm:block">
            {anime.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2.5">
          <Link
            href={watchHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-white shadow-glow-sm transition-all duration-200 hover:brightness-110 active:scale-95"
          >
            <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
            {anime.resumeEpisode && anime.resumeEpisode > 1 ? `Continue EP ${anime.resumeEpisode}` : "Play"}
          </Link>
          <Link
            href={`/anime/${anime.id}`}
            className="inline-flex h-9 items-center rounded-xl border border-line px-3.5 text-xs font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
          >
            View Anime
          </Link>
          {anime.genres && anime.genres.length > 0 && (
            <span className="ml-auto hidden line-clamp-1 max-w-[140px] text-right text-[10px] text-txt-faint lg:block">
              {anime.genres.join(" · ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
