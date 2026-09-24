"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/utils/cn";
import type { AnimeCardItem, SortOption } from "@/types/anime";

const TYPES = ["", "TV", "Movie", "OVA", "ONA", "Special"];
const STATUSES = ["", "RELEASING", "FINISHED", "UPCOMING"];
const SORTS: { value: SortOption; label: string }[] = [
  { value: "TRENDING", label: "Trending" },
  { value: "POPULARITY", label: "Popularity" },
  { value: "RATING", label: "Rating" },
  { value: "NEWEST", label: "Newest" },
  { value: "TITLE", label: "A → Z" },
];
const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Isekai", "Shounen", "Seinen"];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2006, 2004, 2001, 1999, 1998, 1995];
const PER_PAGE = 24;

export function SearchClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const debouncedQuery = useDebounce(query, 400);
  const [genre, setGenre] = useState(params.get("genre") ?? "");
  const [type, setType] = useState(params.get("type") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [year, setYear] = useState(params.get("year") ?? "");
  const [sort, setSort] = useState<SortOption>((params.get("sort") as SortOption) ?? "TRENDING");

  const [items, setItems] = useState<AnimeCardItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const activeFilters = useMemo(
    () => ({ q: debouncedQuery.trim(), genre, type, status, year, sort, page }),
    [debouncedQuery, genre, type, status, year, sort, page]
  );

  const load = useCallback(async (p: number) => {
    const mySeq = ++seq.current;
    setPhase("loading");
    setLoadingMore(p > 1);
    const sp = new URLSearchParams();
    if (activeFilters.q) sp.set("q", activeFilters.q);
    if (activeFilters.genre) sp.set("genre", activeFilters.genre);
    if (activeFilters.type) sp.set("type", activeFilters.type);
    if (activeFilters.status) sp.set("status", activeFilters.status);
    if (activeFilters.year) sp.set("year", String(activeFilters.year));
    sp.set("sort", activeFilters.sort);
    sp.set("page", String(p));
    sp.set("perPage", String(PER_PAGE));
    try {
      const res = await fetch(`/api/anime/search?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Search failed");
      if (mySeq !== seq.current) return; // stale response
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      setHasNext(Boolean(json.hasNextPage));
      setPage(json.page ?? p);
      setPhase("ready");
      setLoadingMore(false);
    } catch {
      if (mySeq !== seq.current) return;
      setPhase("error");
      setLoadingMore(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    load(1);
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v && k !== "page") sp.set(k, String(v));
    }
    const url = sp.toString() ? `/search?${sp.toString()}` : "/search";
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, genre, type, status, year, sort]);

  useEffect(() => {
    // Initial page from URL (e.g. /search?genre=Action)
    const p = parseInt(params.get("page") ?? "1", 10);
    if (p > 1) load(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilters = () => {
    setGenre("");
    setType("");
    setStatus("");
    setYear("");
    setSort("TRENDING");
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="container-kuro pt-24 md:pt-20" ref={topRef}>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Search</h1>
        <p className="mt-1 text-sm text-txt-muted">
          {total > 0 ? `${total} title${total === 1 ? "" : "s"} found` : "Find your next obsession"}
        </p>
      </header>

      <div className="sticky top-16 z-30 -mx-4 bg-ink-950/85 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-2xl sm:px-4">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title…"
              aria-label="Search anime titles"
              className="h-11 w-full rounded-xl border border-line bg-ink-850/80 px-4 pr-10 text-sm text-txt placeholder:text-txt-faint outline-none transition-all hover:border-line-strong focus:border-primary-400/60 focus:ring-2 focus:ring-primary-500/25"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-txt-faint hover:text-txt"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="Sort results"
            className="h-11 rounded-xl border border-line bg-ink-850/80 px-3 text-sm text-txt outline-none transition-colors hover:border-line-strong focus:border-primary-400/60"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {(genre || type || status || year) && (
              <span className="h-2 w-2 rounded-full bg-primary-400" aria-hidden />
            )}
          </Button>
        </div>

        {filtersOpen && (
          <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-ink-900/70 p-4 animate-fade-up sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Genre" value={genre} onChange={setGenre}>
              <option value="">All genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Type" value={type} onChange={setType}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t || "All types"}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Status" value={status} onChange={setStatus}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === "" ? "All statuses" : s === "RELEASING" ? "Airing" : s === "FINISHED" ? "Completed" : "Upcoming"}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="Year" value={year} onChange={setYear}>
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </FilterSelect>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset all filters
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {phase === "error" ? (
          <ErrorState onRetry={() => load(page)} />
        ) : phase === "loading" && items === null ? (
          <SkeletonGrid count={18} />
        ) : phase === "ready" && items?.length === 0 ? (
          <EmptyState
            variant="search"
            title="No results found"
            description={`Nothing matched ${activeFilters.q ? `“${activeFilters.q}”` : "those filters"}. Try different keywords or loosen the filters.`}
            action={
              <Button variant="secondary" className="mt-2" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : phase === "ready" && items ? (
          <>
            <AnimeGrid items={items} />
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    load(page - 1);
                    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Previous
                </Button>
                <span className="px-3 text-sm text-txt-muted" aria-current="page">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => {
                    load(page + 1);
                    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Next
                </Button>
              </nav>
            )}
            {loadingMore && (
              <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-primary-500/20 px-4 py-1.5 text-xs font-semibold text-primary-200 backdrop-blur-md">
                Loading…
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-txt-faint">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full rounded-xl border bg-ink-850/80 px-3 text-sm text-txt outline-none transition-colors",
          "border-line hover:border-line-strong focus:border-primary-400/60"
        )}
      >
        {children}
      </select>
    </label>
  );
}
