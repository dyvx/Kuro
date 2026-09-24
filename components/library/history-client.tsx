"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Clapperboard, History, Play, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useToast } from "@/components/ui/toast";
import { formatRelative, pct } from "@/utils/cn";
import type { StoredProgress } from "@/lib/db/store";

export function HistoryClient() {
  const { status } = useSession();
  const { toast } = useToast();
  const [items, setItems] = useState<StoredProgress[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setPhase("loading");
    fetch("/api/progress")
      .then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        return r.json();
      })
      .then((json) => {
        setItems(json.progress ?? []);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setPhase("ready");
  }, [status, load]);

  const remove = async (animeId: string) => {
    const snapshot = items;
    setItems((prev) => prev?.filter((p) => p.animeId !== animeId) ?? null);
    try {
      await fetch(`/api/progress?animeId=${encodeURIComponent(animeId)}`, { method: "DELETE" });
    } catch {
      setItems(snapshot ?? null);
      toast("Could not remove that entry.", "error");
    }
  };

  if (status === "loading") return <LoadingState className="pt-32" label="Loading history…" />;
  if (status === "unauthenticated" || phase === "ready") {
    if (status === "unauthenticated") {
      return (
        <div className="container-kuro pt-32 md:pt-28">
          <EmptyState
            title="Your history lives here"
            description="Sign in to keep track of every episode you watch and pick up exactly where you left off."
            action={
              <Button className="mt-3" onClick={() => (window.location.href = "/login?callbackUrl=/history")}>
                Sign in
              </Button>
            }
          />
        </div>
      );
    }
  }

  if (phase === "error") {
    return (
      <div className="container-kuro pt-32 md:pt-28">
        <ErrorState onRetry={load} />
      </div>
    );
  }
  if (phase === "loading" || items === null) {
    return <LoadingState className="pt-32" label="Loading history…" />;
  }

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-txt">History</h1>
        <p className="mt-1 text-sm text-txt-muted">{items.length} watched title{items.length === 1 ? "" : "s"}</p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Start watching and your journey will be recorded here automatically."
          action={
            <Button className="mt-3" variant="secondary" onClick={() => (window.location.href = "/")}>
              <History className="h-4 w-4" aria-hidden />
              Find something to watch
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const percent = pct(p.position, p.duration);
            return (
              <li
                key={p.animeId}
                className="group/h flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-3 transition-all duration-300 ease-premium hover:border-primary-400/40 hover:bg-surface-raised"
              >
                <Link href={`/watch/${p.animeId}/${p.episodeId}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-800">
                    {p.animeImage ? (
                      <Image src={p.animeImage} alt="" fill sizes="56px" className="object-cover" unoptimized />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <Clapperboard className="h-4 w-4 text-txt-faint" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="line-clamp-1 text-sm font-semibold text-txt">{p.animeTitle}</span>
                      {p.completed && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <Check className="h-3 w-3" aria-hidden /> Finished
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-txt-muted">
                      Episode {p.episodeNumber} · {p.completed ? "completed" : `${percent}% watched`} · {formatRelative(p.updatedAt)}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/8">
                      <span className="block h-full rounded-full bg-brand-gradient" style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                </Link>
                <Link
                  href={`/watch/${p.animeId}/${p.episodeId}`}
                  className="hidden h-9 items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 text-xs font-bold text-white transition-all hover:brightness-110 sm:inline-flex"
                >
                  <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
                  {p.completed ? "Rewatch" : "Resume"}
                </Link>
                <button
                  onClick={() => remove(p.animeId)}
                  aria-label={`Remove ${p.animeTitle} from history`}
                  className="rounded-lg p-2 text-txt-faint opacity-0 transition-all hover:bg-crimson-500/10 hover:text-crimson-400 focus-visible:opacity-100 group-hover/h:opacity-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
