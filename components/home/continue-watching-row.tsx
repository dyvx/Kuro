"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Play, Trash2, Clapperboard } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { pct, formatTime } from "@/utils/cn";
import type { StoredProgress } from "@/lib/db/store";

export function ContinueWatchingRow({ initial }: { initial: StoredProgress[] }) {
  const [items, setItems] = useState(initial);

  if (!items.length) return null;

  const remove = async (animeId: string, title: string) => {
    const snapshot = items;
    setItems((prev) => prev.filter((p) => p.animeId !== animeId));
    try {
      await fetch(`/api/progress?animeId=${encodeURIComponent(animeId)}`, { method: "DELETE" });
    } catch {
      setItems(snapshot);
    }
  };

  return (
    <section>
      <div className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1">
        {items.map((p) => {
          const percent = pct(p.position, p.duration);
          return (
            <div
              key={p.animeId}
              className="group/cw relative w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface-raised transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-glow sm:w-[320px]"
            >
              <Link href={`/watch/${p.animeId}/${p.episodeId}`} className="flex gap-3 p-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-800">
                  {p.animeImage ? (
                    <Image src={p.animeImage} alt="" fill sizes="56px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Clapperboard className="h-4 w-4 text-txt-faint" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-txt">{p.animeTitle}</p>
                  <p className="mt-0.5 text-xs text-txt-muted">
                    Episode {p.episodeNumber}
                    {p.episodeTitle ? ` · ${p.episodeTitle}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-txt-faint">
                    {formatTime(p.position)} watched · {percent}%
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-300">
                    <Play className="h-3 w-3 fill-primary-300" aria-hidden />
                    Resume
                  </span>
                </div>
              </Link>
              <button
                aria-label={`Remove ${p.animeTitle} from Continue Watching`}
                onClick={() => remove(p.animeId, p.animeTitle)}
                className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-txt-faint opacity-0 backdrop-blur-md transition-all hover:bg-crimson-500/20 hover:text-crimson-400 focus-visible:opacity-100 group-hover/cw:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
