import { AnimeCard } from "./anime-card";
import { cn } from "@/utils/cn";
import type { AnimeCardItem } from "@/types/anime";

export function AnimeGrid({
  items,
  className,
  priorityCount = 8,
}: {
  items: AnimeCardItem[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className
      )}
      role="list"
    >
      {items.map((anime, i) => (
        <div key={anime.id} role="listitem">
          <AnimeCard anime={anime} priority={i < priorityCount} />
        </div>
      ))}
    </div>
  );
}
