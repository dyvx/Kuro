"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { AnimeCardItem, SortOption } from "@/types/anime";

const PER_PAGE = 24;

export function BrowseClient() {
  const [sort, setSort] = useState<SortOption>("POPULARITY");
  const [items, setItems] = useState<AnimeCardItem[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const load = useCallback(async (p: number, s: SortOption) => {
    setPhase("loading");
    try {
      const sp = new URLSearchParams({ sort: s, page: String(p), perPage: String(PER_PAGE) });
      const res = await fetch(`/api/anime/search?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      setItems(json.items ?? []);
      setHasNext(Boolean(json.hasNextPage));
      setPage(json.page ?? p);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    load(1, sort);
  }, [sort, load]);

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Browse</h1>
          <p className="mt-1 text-sm text-txt-muted">Every series in the catalog, one page away.</p>
        </div>
        <div className="flex gap-1.5 rounded-2xl border border-line bg-ink-900/60 p-1.5" role="tablist" aria-label="Sort catalog">
          {(["POPULARITY", "TRENDING", "RATING", "NEWEST"] as SortOption[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              onClick={() => setSort(s)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 ${
                sort === s ? "bg-brand-gradient text-white shadow-glow-sm" : "text-txt-muted hover:bg-white/5 hover:text-txt"
              }`}
            >
              {s === "NEWEST" ? "New" : s === "POPULARITY" ? "Popular" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </header>

      {phase === "error" ? (
        <ErrorState onRetry={() => load(page, sort)} />
      ) : phase === "loading" && items === null ? (
        <SkeletonGrid count={24} />
      ) : items?.length ? (
        <>
          <AnimeGrid items={items} />
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1, sort)}>
              Previous
            </Button>
            <span className="text-sm text-txt-muted">Page {page}</span>
            <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => load(page + 1, sort)}>
              Next
            </Button>
          </div>
        </>
      ) : (
        <EmptyState title="Nothing to browse yet" description="The catalog appears to be empty right now." />
      )}
    </div>
  );
}
