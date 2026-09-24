"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./anime-card";
import { SkeletonRow } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { cn } from "@/utils/cn";
import type { AnimeCardItem } from "@/types/anime";

interface Props {
  items?: AnimeCardItem[];
  loading?: boolean;
  error?: string | null;
  ranked?: boolean;
  onRetry?: () => void;
}

export function AnimeCarousel({ items, loading, error, ranked, onRetry }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, items, loading]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.82), behavior: "smooth" });
  };

  if (error) {
    return <ErrorState onRetry={onRetry} className="py-10" />;
  }
  if (loading || !items) {
    return <SkeletonRow />;
  }
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-txt-muted">
        Nothing here yet — check back soon.
      </p>
    );
  }

  return (
    <div className="group/carousel relative -mx-4 sm:mx-0">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-ink-950 to-transparent sm:w-14" aria-hidden />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-ink-950 to-transparent sm:w-14" aria-hidden />

      <div
        ref={scroller}
        role="list"
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 pt-3 sm:px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((anime, i) => (
          <div
            key={`${anime.id}-${i}`}
            role="listitem"
            className="w-[150px] shrink-0 snap-start sm:w-[172px] lg:w-[186px]"
          >
            <AnimeCard anime={anime} rank={ranked ? i + 1 : undefined} priority={i < 6} />
          </div>
        ))}
      </div>

      <CarouselButton
        side="left"
        visible={canPrev}
        onClick={() => scrollBy(-1)}
        label="Scroll carousel left"
      />
      <CarouselButton
        side="right"
        visible={canNext}
        onClick={() => scrollBy(1)}
        label="Scroll carousel right"
      />
    </div>
  );
}

function CarouselButton({
  side,
  visible,
  onClick,
  label,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "glass-strong absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-txt shadow-card transition-all duration-300 ease-premium",
        "hover:scale-110 hover:text-primary-200 active:scale-95",
        "lg:flex",
        side === "left" ? "left-3" : "right-3",
        visible ? "opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="h-5 w-5" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
