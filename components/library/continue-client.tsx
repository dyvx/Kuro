"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Clapperboard, Play, Trash2, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { formatRelative } from "@/utils/cn";

/* ────────────────────────────────────────────────────────────────
   SMART CONTINUE WATCHING — resume the exact second, or roll into
   the next episode when the saved one is essentially finished.
   Data comes from /api/continue (server-resolved, never guessed).
   ──────────────────────────────────────────────────────────────── */

interface ContinueItem {
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  episodeNumber: number;
  resumeEpisodeId: string;
  resumeEpisodeNumber: number;
  movingToNext: boolean;
  percent: number;
  updatedAt: string;
}

export function ContinueClient() {
  const { status } = useSession();
  const [items, setItems] = useState<ContinueItem[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setPhase("loading");
    fetch("/api/continue")
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

  const remove = useCallback(async (animeId: string) => {
    const snapshot = items;
    setItems((prev) => prev?.filter((i) => i.animeId !== animeId) ?? null);
    try {
      await fetch(`/api/continue?animeId=${encodeURIComponent(animeId)}`, { method: "DELETE" });
    } catch {
      setItems(snapshot ?? null);
    }
  }, [items]);

  if (status === "loading") return <LoadingState className="pt-32" label="Loading…" />;

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Continue Watching</h1>
        <p className="mt-1 text-sm text-txt-muted">Pick up at the exact second — or roll into the next episode.</p>
      </header>

      {status === "unauthenticated" || (phase === "ready" && !items?.length) ? (
        <EmptyState
          title={status === "unauthenticated" ? "Nothing to resume yet" : "All caught up"}
          description={
            status === "unauthenticated"
              ? "Sign in and KURO will remember the exact second you pause — on any device."
              : "Nothing in progress right now. Start a new series and it'll appear here."
          }
          action={
            status === "unauthenticated" ? (
              <Button className="mt-3" onClick={() => (window.location.href = "/login?callbackUrl=/continue-watching")}>
                Sign in
              </Button>
            ) : (
              <Button className="mt-3" variant="secondary" onClick={() => (window.location.href = "/browse")}>
                Browse anime
              </Button>
            )
          }
        />
      ) : phase === "error" ? (
        <ErrorState onRetry={load} />
      ) : phase === "loading" || items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ContinueCard key={item.animeId} item={item} onRemove={() => void remove(item.animeId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ContinueCard({ item, onRemove }: { item: ContinueItem; onRemove: () => void }) {
  const href = `/watch/${item.animeId}/${item.resumeEpisodeId}`;
  return (
    <li className="group relative flex gap-3.5 rounded-2xl border border-line bg-surface/60 p-3 transition-all duration-300 ease-premium hover:-translate-y-0.5 hover:border-primary-400/40 hover:bg-surface-raised hover:shadow-card">
      <Link href={href} className="relative h-[96px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-ink-800" aria-label={`Continue ${item.animeTitle}`}>
        {item.animeImage ? (
          <Image src={item.animeImage} alt="" fill sizes="68px" className="object-cover" unoptimized />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-txt-faint" aria-hidden />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient shadow-glow">
            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
          </span>
        </span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-1 pr-7 text-sm font-bold text-txt transition-colors group-hover:text-primary-200">
            {item.animeTitle}
          </h3>
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-txt-muted">
          {item.movingToNext ? (
            <span className="inline-flex items-center gap-1 font-bold text-primary-300">
              <FastForward className="h-3 w-3" aria-hidden />
              Up next: EP {item.resumeEpisodeNumber}
            </span>
          ) : (
            <span>EP {item.episodeNumber}</span>
          )}
          <span className="text-txt-faint">· {item.percent}%</span>
          <span className="text-txt-faint">· {formatRelative(item.updatedAt)}</span>
        </p>

        <div className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="block h-full rounded-full bg-brand-gradient transition-[width] duration-500"
            style={{ width: `${item.percent}%` }}
          />
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2.5">
          <Link
            href={href}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-4 text-xs font-bold text-white shadow-glow-sm transition-all hover:brightness-110 active:scale-95"
          >
            <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
            {item.movingToNext ? `Play EP ${item.resumeEpisodeNumber}` : `Resume EP ${item.episodeNumber}`}
          </Link>
        </div>
      </div>

      <button
        onClick={onRemove}
        aria-label={`Remove ${item.animeTitle} from Continue Watching`}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-txt-faint transition-colors hover:bg-crimson-500/10 hover:text-crimson-400"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}
