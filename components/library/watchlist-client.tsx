"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark, Clapperboard, Search, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useToast } from "@/components/ui/toast";
import type { StoredLibraryItem } from "@/lib/db/store";

type SortMode = "recent" | "title" | "rating";

export function WatchlistClient() {
  const { status } = useSession();
  const { toast } = useToast();
  const [items, setItems] = useState<StoredLibraryItem[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const load = useCallback(() => {
    setPhase("loading");
    fetch("/api/watchlist")
      .then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        return r.json();
      })
      .then((json) => {
        setItems(json.items ?? []);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setPhase("ready");
  }, [status, load]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.animeTitle.toLowerCase().includes(q));
    if (sort === "title") list = [...list].sort((a, b) => a.animeTitle.localeCompare(b.animeTitle));
    else if (sort === "rating") list = [...list].sort((a, b) => (b.animeRating ?? 0) - (a.animeRating ?? 0));
    else list = [...list].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return list;
  }, [items, query, sort]);

  const remove = async (animeId: string, title: string) => {
    const snapshot = items;
    setItems((prev) => prev?.filter((i) => i.animeId !== animeId) ?? null);
    try {
      await fetch(`/api/watchlist?animeId=${encodeURIComponent(animeId)}`, { method: "DELETE" });
      toast(`Removed ${title}.`, "info");
    } catch {
      setItems(snapshot ?? null);
      toast("Could not remove that title.", "error");
    }
  };

  if (status === "loading") return <LoadingState className="pt-32" label="Loading your watchlist…" />;
  if (status === "unauthenticated") {
    return (
      <div className="container-kuro pt-32 md:pt-28">
        <EmptyState
          title="Your watchlist awaits"
          description="Sign in to bookmark anime, sync progress across devices, and never lose your place."
          action={
            <Button className="mt-3" onClick={() => (window.location.href = "/login?callbackUrl=/watchlist")}>
              Sign in to continue
            </Button>
          }
        />
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="container-kuro pt-32 md:pt-28">
        <ErrorState onRetry={load} />
      </div>
    );
  }
  if (phase === "loading" || items === null) {
    return <LoadingState className="pt-32" label="Loading your watchlist…" />;
  }

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Watchlist</h1>
          <p className="mt-1 text-sm text-txt-muted">
            {items.length} title{items.length === 1 ? "" : "s"} saved
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-faint" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter watchlist…"
                aria-label="Filter watchlist"
                className="h-10 pl-9"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="Sort watchlist"
              className="h-10 rounded-xl border border-line bg-ink-850/80 px-3 text-sm text-txt outline-none hover:border-line-strong focus:border-primary-400/60"
            >
              <option value="recent">Recently added</option>
              <option value="title">A → Z</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        )}
      </header>

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Nothing saved yet" : "No matches"}
          description={
            items.length === 0
              ? "Tap the bookmark on any anime and it will live here, ready for your next binge."
              : "No titles match your filter."
          }
          action={
            items.length === 0 ? (
              <Button className="mt-3" variant="secondary" onClick={() => (window.location.href = "/browse")}>
                <Bookmark className="h-4 w-4" aria-hidden />
                Discover anime
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => (
            <li key={item.animeId} className="group/wl relative">
              <Link href={`/anime/${item.animeId}`} className="block overflow-hidden rounded-2xl">
                <span className="relative block aspect-[2/3] w-full transition-transform duration-500 ease-premium group-hover/wl:scale-[1.04]">
                  {item.animeImage ? (
                    <Image src={item.animeImage} alt={item.animeTitle} fill sizes="(max-width:640px) 45vw, 240px" className="rounded-2xl object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-raised">
                      <Clapperboard className="h-6 w-6 text-txt-faint" aria-hidden />
                    </span>
                  )}
                  <span className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover/wl:opacity-100" aria-hidden />
                </span>
              </Link>
              <div className="mt-2 px-0.5">
                <p className="line-clamp-1 text-sm font-semibold text-txt">{item.animeTitle}</p>
                <p className="text-xs text-txt-faint">
                  {[item.animeType, item.animeYear, item.animeRating ? `★ ${item.animeRating.toFixed(1)}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={() => remove(item.animeId, item.animeTitle)}
                aria-label={`Remove ${item.animeTitle} from watchlist`}
                className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white/80 backdrop-blur-md transition-all hover:bg-crimson-500/30 hover:text-crimson-300 focus-visible:opacity-100 sm:opacity-0 sm:group-hover/wl:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
