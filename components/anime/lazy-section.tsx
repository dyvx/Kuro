"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeader } from "./section-row";
import { AnimeCarousel } from "./anime-carousel";
import { ErrorState } from "@/components/states";
import type { AnimeCardItem } from "@/types/anime";

/**
 * Lazy homepage section — data is fetched ONLY when the section scrolls
 * close to the viewport (spec: request data when necessary).
 */
export function LazySection({
  title,
  slug,
  ranked,
  viewAllHref,
  subtitle,
  perPage = 18,
}: {
  title: string;
  slug: string;
  ranked?: boolean;
  viewAllHref?: string;
  subtitle?: string;
  perPage?: number;
}) {
  const hostRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [items, setItems] = useState<AnimeCardItem[] | null>(null);
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setState("loading");
    fetch(`/api/anime/section?slug=${encodeURIComponent(slug)}&perPage=${perPage}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Provider unavailable");
        return json;
      })
      .then((json) => {
        setItems(json.items ?? []);
        setState("ready");
      })
      .catch(() => {
        started.current = false;
        setState("error");
      });
  }, [slug, perPage]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [load]);

  return (
    <section ref={hostRef} className="mt-12 first:mt-0">
      <SectionHeader title={title} viewAllHref={viewAllHref} subtitle={subtitle} />
      {state === "error" ? (
        <ErrorState onRetry={load} className="py-8" />
      ) : (
        <AnimeCarousel
          items={state === "ready" ? items ?? [] : undefined}
          loading={state !== "ready"}
          ranked={ranked}
          onRetry={load}
        />
      )}
    </section>
  );
}
