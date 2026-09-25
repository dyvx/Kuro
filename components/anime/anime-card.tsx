"use client";

import Link from "next/link";
import { memo } from "react";
import { Play, Star } from "lucide-react";
import { Poster } from "./poster";
import { cn } from "@/utils/cn";
import type { AnimeCardItem } from "@/types/anime";

export const AnimeCard = memo(function AnimeCard({
  anime,
  rank,
  className,
  priority,
}: {
  anime: AnimeCardItem;
  rank?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <article className={cn("group/card relative", className)}>
      <div className="relative overflow-hidden rounded-2xl">
        <Link
          href={`/anime/${anime.id}`}
          aria-label={`View ${anime.title}`}
          className="block aspect-[2/3] w-full"
        >
          <span className="absolute inset-0 transition-transform duration-500 ease-premium group-hover/card:scale-[1.06]">
            <Poster
              src={anime.image}
              alt={anime.title}
              color={anime.color}
              priority={priority}
              className="rounded-2xl"
            />
          </span>

          {/* gradient veil — always on touch, hover-reveal on desktop */}
          <span
            className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover/card:opacity-100"
            aria-hidden
          />

          {/* hover actions — always on touch, hover-reveal on desktop */}
          <span className="absolute inset-x-0 bottom-0 flex translate-y-0 items-center justify-between p-3 opacity-100 transition-all duration-300 ease-premium sm:translate-y-2 sm:opacity-0 sm:group-hover/card:translate-y-0 sm:group-hover/card:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
              <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
              Watch
            </span>
            {anime.rating != null && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-black/50 px-2 py-1.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-300" aria-hidden />
                {anime.rating.toFixed(1)}
              </span>
            )}
          </span>

          {/* type chip */}
          <span className="absolute right-2 top-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-md">
            {anime.type}
          </span>
        </Link>
      </div>

      {/* rank badge — outside the clipping container so its top is visible */}
      {rank != null && (
        <span
          className="pointer-events-none absolute -left-1 -top-3 select-none font-display text-[56px] font-bold leading-none rank-outline drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
          aria-hidden
        >
          {rank}
        </span>
      )}

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-txt transition-colors group-hover/card:text-primary-200">
          <Link href={`/anime/${anime.id}`}>{anime.title}</Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-txt-faint">
          {anime.japaneseTitle ?? [anime.year, anime.episodes ? `${anime.episodes} eps` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </article>
  );
});
