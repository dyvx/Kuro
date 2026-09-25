"use client";

import { useMemo, useState } from "react";
import { Server, ServerOff, Ban, Languages } from "lucide-react";
import { cn } from "@/utils/cn";
import type { EpisodeServer } from "@/types/anime";

interface Props {
  servers: EpisodeServer[];
  activeServerId: string | null;
  failedIds: Set<string>;
  disabled?: boolean;
  onSelect: (serverId: string) => void;
}

const LANG_ORDER = ["sub", "dub", "raw"] as const;
const LANG_LABEL: Record<string, string> = { sub: "SUB", dub: "DUB", raw: "RAW" };

/**
 * Premium manual server switcher.
 * • Groups servers by audio category (SUB / DUB / RAW) when available
 * • Active server highlighted; failed servers grayed out + disabled
 * • Manual recovery only — the app never auto-switches (spec §4)
 */
export function ServerSwitcher({ servers, activeServerId, failedIds, disabled, onSelect }: Props) {
  const activeServer = servers.find((s) => s.id === activeServerId);
  const [langOverride, setLangOverride] = useState<string | null>(null);
  const activeLang = langOverride ?? activeServer?.category ?? "sub";

  const languages = useMemo(() => {
    const present = new Set(servers.map((s) => s.category ?? "sub"));
    return LANG_ORDER.filter((l) => present.has(l));
  }, [servers]);

  if (!servers.length) return null;

  const visibleServers = languages.length > 1 ? servers.filter((s) => (s.category ?? "sub") === activeLang) : servers;

  const pickLang = (lang: string) => {
    setLangOverride(lang);
    const inLang = servers.filter((s) => (s.category ?? "sub") === lang && !failedIds.has(s.id));
    const candidate = inLang.find((s) => s.available !== false);
    if (candidate && candidate.id !== activeServerId) onSelect(candidate.id);
  };

  return (
    <section aria-label="Streaming servers">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-txt-faint">Servers</p>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-txt-muted">
            Manual selection
          </span>
        </div>
        {languages.length > 1 && (
          <div
            className="flex gap-1 rounded-xl border border-line bg-ink-900/60 p-1"
            role="tablist"
            aria-label="Audio track"
          >
            <Languages className="mx-1 h-3.5 w-3.5 self-center text-txt-faint" aria-hidden />
            {languages.map((lang) => (
              <button
                key={lang}
                role="tab"
                aria-selected={activeLang === lang}
                onClick={() => pickLang(lang)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all",
                  activeLang === lang
                    ? "bg-brand-gradient text-white shadow-glow-sm"
                    : "text-txt-muted hover:bg-white/5 hover:text-txt"
                )}
              >
                {LANG_LABEL[lang] ?? lang.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Choose a server"
      >
        {visibleServers.map((server) => {
          const isActive = server.id === activeServerId;
          const isFailed = failedIds.has(server.id);
          const unavailable = server.available === false;
          const isDisabled = disabled || isFailed || unavailable;

          return (
            <button
              key={server.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`Server ${server.name}${isFailed ? " (failed earlier this session)" : ""}`}
              disabled={isDisabled}
              onClick={() => onSelect(server.id)}
              className={cn(
                "group relative flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-250 ease-premium",
                isActive
                  ? "border-primary-400/70 bg-brand-gradient text-white shadow-glow-sm"
                  : "border-line bg-surface-raised text-txt-muted hover:border-line-strong hover:text-txt",
                isFailed &&
                  "cursor-not-allowed border-crimson-500/25 bg-crimson-500/[0.06] text-txt-faint opacity-60 hover:border-crimson-500/25",
                unavailable && !isFailed && "cursor-not-allowed opacity-45",
                !isDisabled && "active:scale-[0.97]"
              )}
            >
              {isFailed ? (
                <Ban className="h-4 w-4 text-crimson-400/80" aria-hidden />
              ) : unavailable ? (
                <ServerOff className="h-4 w-4" aria-hidden />
              ) : (
                <Server className={cn("h-4 w-4", isActive ? "text-white" : "text-primary-300")} aria-hidden />
              )}
              {server.name}
              {isFailed && <span className="text-[10px] font-bold uppercase text-crimson-400/90">failed</span>}
              {isActive && !isFailed && (
                <span className="absolute -bottom-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white/80" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
