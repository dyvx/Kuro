"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Star, Check, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/utils/cn";
import type { AnimeCardItem } from "@/types/anime";

const ROTATE_MS = 8000;

interface HeroAnime extends AnimeCardItem {
  description?: string;
  featuredLabel?: string;
}

export function HeroBanner({ items }: { items: HeroAnime[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const go = useCallback(
    (i: number) => setIndex(((i % items.length) + items.length) % items.length),
    [items.length]
  );

  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, reduced, items.length]);

  if (!items.length) return null;
  const active = items[index];
  const bg = active.banner || active.image;

  return (
    <section
      aria-label="Featured anime"
      aria-roledescription="carousel"
      className="relative -mt-16 h-[88svh] min-h-[540px] max-h-[820px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* stacked backdrops — crossfade between featured titles */}
      {items.map((item, i) => {
        const url = item.banner || item.image;
        return (
          <div
            key={item.id}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-premium",
              i === index ? "opacity-100" : "opacity-0"
            )}
          >
            {url && (
              <Image
                src={url}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className={cn("object-cover", !reduced && i === index && "animate-ken-burns")}
                unoptimized
              />
            )}
          </div>
        );
      })}

      {/* readability gradients */}
      <div className="absolute inset-0 bg-hero-fade" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-bottom-fade" aria-hidden />

      {/* content */}
      <div className="absolute inset-0 flex items-end">
        <div key={active.id} className="container-kuro w-full pb-16 pt-28 sm:pb-20">
          <div className="max-w-2xl animate-fade-up">
            {active.featuredLabel && (
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-200 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" aria-hidden />
                {active.featuredLabel}
              </p>
            )}
            <h1 className="text-shadow-hero font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              {active.title}
            </h1>
            {active.japaneseTitle && (
              <p className="mt-2 text-sm font-medium text-white/60 sm:text-base">
                {active.japaneseTitle}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/80">
              {active.rating != null && (
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" aria-hidden />
                  {active.rating.toFixed(1)}
                </span>
              )}
              {active.year && <span>{active.year}</span>}
              <span className="rounded-md border border-white/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                {active.type}
              </span>
              {active.status && <StatusBadge status={active.status} />}
              {active.episodes ? <span>{active.episodes} episodes</span> : null}
            </div>

            {active.genres && active.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {active.genres.slice(0, 4).map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {active.description && (
              <p className="text-shadow-hero mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-[15px]">
                {active.description}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${active.id}/1`}
                className="inline-flex h-12 items-center gap-2.5 rounded-2xl bg-brand-gradient px-7 text-[15px] font-bold text-white shadow-glow transition-all duration-300 ease-premium hover:scale-[1.03] hover:shadow-glow active:scale-95"
              >
                <Play className="h-5 w-5 fill-white" aria-hidden />
                Watch Now
              </Link>
              <HeroListButton anime={active} />
            </div>
          </div>

          {/* slide indicators */}
          {items.length > 1 && (
            <div className="mt-8 flex items-center gap-2" role="tablist" aria-label="Featured slides">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show ${it.title}`}
                  onClick={() => go(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-400 ease-premium",
                    i === index
                      ? "w-10 bg-brand-gradient"
                      : "w-4 bg-white/25 hover:bg-white/45"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "RELEASING" ? "Airing" : status === "FINISHED" ? "Completed" : status === "UPCOMING" ? "Upcoming" : status;
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "RELEASING" ? "animate-pulse-soft bg-emerald-400" : status === "UPCOMING" ? "bg-sky-400" : "bg-white/50"
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

function HeroListButton({ anime }: { anime: HeroAnime }) {
  const { status: authStatus } = useSession();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (authStatus !== "authenticated") {
      toast("Sign in to build your watchlist.", "info");
      return;
    }
    setBusy(true);
    try {
      if (added) {
        await fetch(`/api/watchlist?animeId=${encodeURIComponent(anime.id)}`, { method: "DELETE" });
        setAdded(false);
        toast(`Removed ${anime.title} from your watchlist.`, "info");
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            animeId: anime.id,
            animeTitle: anime.title,
            animeImage: anime.image,
            animeType: anime.type,
            animeYear: anime.year,
            animeRating: anime.rating,
          }),
        });
        if (!res.ok) throw new Error();
        setAdded(true);
        toast(`Added ${anime.title} to your watchlist.`, "success");
      }
    } catch {
      toast("Could not update the watchlist. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="glass inline-flex h-12 items-center gap-2.5 rounded-2xl px-6 text-[15px] font-bold text-white transition-all duration-300 ease-premium hover:scale-[1.03] hover:border-white/25 active:scale-95 disabled:opacity-60"
    >
      {added ? <Check className="h-5 w-5 text-emerald-400" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
      {added ? "In List" : "Add to List"}
    </button>
  );
}

