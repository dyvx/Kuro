"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/anime/section-row";
import { ContinueWatchingRow } from "./continue-watching-row";
import { useSession } from "next-auth/react";
import { SkeletonRow } from "@/components/ui/skeleton";
import type { StoredProgress } from "@/lib/db/store";

/** Client component: fetches watch progress only when a session exists. */
export function ContinueWatchingLazy() {
  const { status } = useSession();
  const [items, setItems] = useState<StoredProgress[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || loaded) return;
    setLoaded(true);
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const inProgress: StoredProgress[] = (json?.progress ?? []).filter(
          (p: StoredProgress) => !p.completed
        );
        setItems(inProgress.slice(0, 10));
      })
      .catch(() => setItems([]));
  }, [status, loaded]);

  if (status !== "authenticated") return null;
  if (items === null) {
    return (
      <section className="mt-4">
        <SectionHeader title="Continue Watching" />
        <SkeletonRow count={4} />
      </section>
    );
  }
  if (!items.length) return null;

  return (
    <section className="mt-4">
      <SectionHeader title="Continue Watching" viewAllHref="/continue-watching" />
      <ContinueWatchingRow initial={items} />
    </section>
  );
}
