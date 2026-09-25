"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Bookmark, CheckCircle2, Heart, LogOut, Clock3, Play, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/states";
import { loadPrefs, savePrefs, type PlayerPrefs } from "@/lib/player/player-types";
import { AIAdminSettings } from "@/components/ai/ai-admin-settings";

interface Stats {
  watching: number;
  completed: number;
  watchlist: number;
  favorites: number;
}

export function ProfileClient() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    setAutoplay(loadPrefs().autoplayNext);
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/progress").then((r) => (r.ok ? r.json() : { progress: [] })),
      fetch("/api/watchlist").then((r) => (r.ok ? r.json() : { items: [] })),
      fetch("/api/favorites").then((r) => (r.ok ? r.json() : { items: [] })),
    ])
      .then(([progress, watchlist, favorites]) => {
        const all = progress.progress ?? [];
        setStats({
          watching: all.filter((p: { completed: boolean }) => !p.completed).length,
          completed: all.filter((p: { completed: boolean }) => p.completed).length,
          watchlist: watchlist.items?.length ?? 0,
          favorites: favorites.items?.length ?? 0,
        });
      })
      .catch(() => setStats({ watching: 0, completed: 0, watchlist: 0, favorites: 0 }));
  }, [status]);

  if (status === "loading") return <LoadingState className="pt-32" label="Loading profile…" />;

  if (status === "unauthenticated") {
    return (
      <div className="container-kuro pt-32 text-center md:pt-28">
        <h1 className="font-display text-2xl font-bold text-txt">You&apos;re browsing as a guest</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-txt-muted">
          Sign in to unlock watchlists, favorites, resume playback, and cross-device sync.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?callbackUrl=/profile"><Button>Sign in</Button></Link>
          <Link href="/register"><Button variant="secondary">Create account</Button></Link>
        </div>
      </div>
    );
  }

  const name = session?.user?.name ?? "Viewer";
  const email = session?.user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  const tiles = [
    { label: "In Progress", value: stats?.watching, icon: Play, href: "/continue-watching" },
    { label: "Completed", value: stats?.completed, icon: CheckCircle2, href: "/history" },
    { label: "Watchlist", value: stats?.watchlist, icon: Bookmark, href: "/watchlist" },
    { label: "Favorites", value: stats?.favorites, icon: Heart, href: "/watchlist" },
  ];

  return (
    <div className="container-kuro max-w-3xl pt-24 md:pt-20">
      <header className="flex items-center gap-5">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500 to-crimson-500 font-display text-3xl font-bold text-white shadow-glow">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold text-txt">{name}</h1>
          <p className="truncate text-sm text-txt-muted">{email}</p>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="group rounded-2xl border border-line bg-surface/60 p-4 transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-primary-400/40 hover:shadow-glow-sm"
          >
            <t.icon className="h-5 w-5 text-primary-300" aria-hidden />
            <p className="mt-3 font-display text-2xl font-bold text-txt">
              {t.value ?? "—"}
            </p>
            <p className="text-xs font-semibold text-txt-faint">{t.label}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="font-display text-lg font-bold text-txt">Preferences</h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between">
          <span className="flex items-center gap-2.5 text-sm text-txt">
            <Play className="h-4 w-4 text-primary-300" aria-hidden />
            Autoplay next episode
          </span>
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => {
              setAutoplay(e.target.checked);
              const prefs: PlayerPrefs = { ...loadPrefs(), autoplayNext: e.target.checked };
              savePrefs(prefs);
            }}
            className="h-4 w-4 accent-[#8b5cf6]"
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-txt-faint">
          When an episode ends, jump straight into the next one. You can also toggle this from the
          player settings menu.
        </p>

      <AIAdminSettings />
      </section>

      <section className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/continue-watching"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-txt-muted transition-colors hover:border-primary-400/40 hover:text-primary-200"
        >
          <Clock3 className="h-4 w-4" aria-hidden /> Continue Watching
        </Link>
        <Link
          href="/history"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-txt-muted transition-colors hover:border-primary-400/40 hover:text-primary-200"
        >
          <History className="h-4 w-4" aria-hidden /> History
        </Link>
        <Button
          variant="danger"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="ml-auto"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </section>
    </div>
  );
}
