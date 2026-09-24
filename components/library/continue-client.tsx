"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ContinueWatchingRow } from "@/components/home/continue-watching-row";
import type { StoredProgress } from "@/lib/db/store";

export function ContinueClient() {
  const { status } = useSession();
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
        setItems((json.progress ?? []).filter((p: StoredProgress) => !p.completed));
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setPhase("ready");
  }, [status, load]);

  if (status === "loading") return <LoadingState className="pt-32" label="Loading…" />;

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Continue Watching</h1>
        <p className="mt-1 text-sm text-txt-muted">Pick up exactly where you left off.</p>
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
        <LoadingState label="Loading your queue…" />
      ) : (
        <ContinueWatchingRow initial={items} />
      )}
    </div>
  );
}
