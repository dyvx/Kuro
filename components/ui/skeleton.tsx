import { cn } from "@/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Poster-shaped card skeleton used across grids/carousels. */
export function SkeletonCard({ withTitle = true }: { withTitle?: boolean }) {
  return (
    <div className="w-full">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      {withTitle && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="scrollbar-none flex gap-4 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[152px] shrink-0 sm:w-[172px]">
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-none">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-end">
        <div className="container-kuro pb-16">
          <div className="max-w-xl space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-12 w-36 rounded-xl" />
              <Skeleton className="h-12 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary-500/30 border-t-primary-400",
        className
      )}
    />
  );
}
