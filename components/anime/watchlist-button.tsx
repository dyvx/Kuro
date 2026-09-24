"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Heart, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/utils/cn";

interface AnimeMeta {
  id: string;
  title: string;
  image?: string | null;
  type?: string;
  year?: number | null;
  rating?: number | null;
}

export function WatchlistButton({ anime, className }: { anime: AnimeMeta; className?: string }) {
  const { status: authStatus } = useSession();
  const { toast } = useToast();
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch(`/api/watchlist?animeId=${encodeURIComponent(anime.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setInList(Boolean(json.inWatchlist));
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [authStatus, anime.id]);

  const toggle = async () => {
    if (authStatus !== "authenticated") {
      toast("Sign in to build your watchlist.", "info");
      return;
    }
    setBusy(true);
    try {
      if (inList) {
        const res = await fetch(`/api/watchlist?animeId=${encodeURIComponent(anime.id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setInList(false);
        toast(`Removed ${anime.title} from your watchlist.`, "info");
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            animeId: anime.id,
            animeTitle: anime.title,
            animeImage: anime.image ?? null,
            animeType: anime.type,
            animeYear: anime.year ?? null,
            animeRating: anime.rating ?? null,
          }),
        });
        if (!res.ok) throw new Error();
        setInList(true);
        toast(`Added ${anime.title} to your watchlist.`, "success");
      }
    } catch {
      toast("Could not update the watchlist. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const Icon = busy ? LoaderCircle : inList ? BookmarkCheck : Bookmark;

  return (
    <button
      onClick={toggle}
      disabled={busy || (authStatus === "authenticated" && !checked)}
      aria-pressed={inList}
      className={cn(
        "inline-flex h-12 items-center gap-2.5 rounded-2xl border px-6 text-[15px] font-bold transition-all duration-300 ease-premium active:scale-95 disabled:opacity-60",
        inList
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
          : "glass border-white/12 text-white hover:scale-[1.03] hover:border-white/25",
        className
      )}
    >
      <Icon className={cn("h-5 w-5", busy && "animate-spin")} aria-hidden />
      {inList ? "In Watchlist" : "Add to Watchlist"}
    </button>
  );
}

export function FavoriteButton({ anime }: { anime: AnimeMeta }) {
  const { status: authStatus } = useSession();
  const { toast } = useToast();
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.items?.some((i: { animeId: string }) => i.animeId === anime.id)) setFav(true);
      })
      .catch(() => {});
  }, [authStatus, anime.id]);

  const toggle = async () => {
    if (authStatus !== "authenticated") {
      toast("Sign in to save favorites.", "info");
      return;
    }
    setBusy(true);
    try {
      if (fav) {
        const res = await fetch(`/api/favorites?animeId=${encodeURIComponent(anime.id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setFav(false);
        toast("Removed from favorites.", "info");
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            animeId: anime.id,
            animeTitle: anime.title,
            animeImage: anime.image ?? null,
            animeType: anime.type,
            animeYear: anime.year ?? null,
            animeRating: anime.rating ?? null,
          }),
        });
        if (!res.ok) throw new Error();
        setFav(true);
        toast("Added to favorites ♥", "success");
      }
    } catch {
      toast("Could not update favorites. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 ease-premium active:scale-90 disabled:opacity-60",
        fav
          ? "border-crimson-500/40 bg-crimson-500/15 shadow-glow-crimson"
          : "glass border-white/12 text-white hover:scale-[1.06] hover:border-crimson-500/40"
      )}
    >
      <Heart className={cn("h-5 w-5 transition-colors", fav ? "fill-crimson-500 text-crimson-500" : "text-white")} aria-hidden />
    </button>
  );
}
