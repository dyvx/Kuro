"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Star, LoaderCircle, Film } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/utils/cn";

interface QuickResult {
  id: string;
  title: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  image: string | null;
  year: number | null;
  type: string;
  rating: number | null;
}

type Phase = "idle" | "loading" | "done" | "error";

export function SearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickResult[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebounce(query, 350);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setResults([]);
      setPhase("idle");
      return;
    }
    const controller = new AbortController();
    setPhase("loading");
    fetch(`/api/anime/quick-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        setResults(json.items ?? []);
        setPhase("done");
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setPhase("error");
      });
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      onNavigate?.();
      router.push(path);
    },
    [router, onNavigate]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        go(`/anime/${results[activeIndex].id}`);
      } else if (query.trim()) {
        go(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-faint" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="kuro-quick-results"
          aria-label="Search anime"
          placeholder="Search anime…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-xl border border-line bg-white/[0.04] pl-10 pr-9 text-sm text-txt placeholder:text-txt-faint outline-none transition-all duration-200 hover:border-line-strong focus:border-primary-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-primary-500/20"
        />
        {phase === "loading" && (
          <LoaderCircle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-300" aria-hidden />
        )}
      </div>

      {showPanel && (
        <div
          id="kuro-quick-results"
          role="listbox"
          aria-label="Search results"
          className="glass-strong absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl shadow-card-lg animate-scale-in"
        >
          {phase === "error" ? (
            <div className="px-4 py-6 text-center text-sm text-crimson-400">
              Search is temporarily unavailable.
            </div>
          ) : phase === "loading" ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-14 w-10 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <SearchXIcon />
              <p className="text-sm font-medium text-txt">No results for “{query.trim()}”</p>
              <p className="text-xs text-txt-faint">Check the spelling or try a different title.</p>
            </div>
          ) : (
            <>
              <ul className="max-h-[380px] overflow-y-auto p-2">
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(`/anime/${r.id}`)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                        i === activeIndex ? "bg-primary-500/12" : "hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                        {r.image ? (
                          <Image
                            src={r.image}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center">
                            <Film className="h-4 w-4 text-txt-faint" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-txt">
                          {r.title}
                        </span>
                        {r.japaneseTitle && (
                          <span className="block truncate text-xs text-txt-faint">
                            {r.japaneseTitle}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-txt-muted">
                        {r.rating != null && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Star className="h-3 w-3 fill-amber-300" aria-hidden />
                            {r.rating.toFixed(1)}
                          </span>
                        )}
                        <span>{r.type}</span>
                        {r.year && <span>{r.year}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="block border-t border-line bg-primary-500/[0.07] px-4 py-3 text-center text-sm font-semibold text-primary-300 transition-colors hover:bg-primary-500/[0.14]"
              >
                View all results →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchXIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
      <Search className="h-4 w-4 text-txt-faint" aria-hidden />
    </span>
  );
}
