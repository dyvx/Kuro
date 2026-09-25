"use client";

import { useCallback, useEffect, useState } from "react";
import { EpisodeBrowser } from "./episode-browser";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { EpisodeBundle } from "@/types/anime";

/**
 * Client-side episode browser loader — the page renders instantly and
 * episodes stream in (providers can take a while on a cold scrape).
 */
export function EpisodeBrowserLazy({ animeId, animeTitle }: { animeId: string; animeTitle: string }) {
  const [bundle, setBundle] = useState<EpisodeBundle | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    setPhase("loading");
    fetch(`/api/anime/episodes?id=${encodeURIComponent(animeId)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Failed");
        return json as EpisodeBundle;
      })
      .then((json) => {
        setBundle(json);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, [animeId]);

  useEffect(() => {
    load();
  }, [load, attempt]);

  if (phase === "error") {
    return (
      <ErrorState
        title="Episodes took too long to load"
        description="The provider is still scraping this title. Give it a moment and retry."
        onRetry={() => setAttempt((a) => a + 1)}
        className="py-10"
      />
    );
  }

  if (phase === "loading" || !bundle) {
    return (
      <div aria-hidden>
        <div className="mb-5 flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-56 rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-line">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bundle.episodes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-txt-muted">
        No episodes are available for this title yet.
      </div>
    );
  }

  return (
    <EpisodeBrowser
      animeId={animeId}
      animeTitle={animeTitle}
      seasons={bundle.seasons}
      episodes={bundle.episodes}
    />
  );
}
