"use client";

import { Server, ServerOff, Ban, Frame } from "lucide-react";
import { cn } from "@/utils/cn";
import type { EpisodeServer } from "@/types/anime";

interface Props {
  servers: EpisodeServer[];
  activeServerId: string | null;
  failedIds: Set<string>;
  disabled?: boolean;
  onSelect: (serverId: string) => void;
}

/**
 * Premium manual server switcher.
 * • Active server highlighted
 * • Failed servers (this session) are grayed out + disabled — manual recovery
 * • Smooth switching, horizontal scroll on mobile, large touch targets
 */
export function ServerSwitcher({ servers, activeServerId, failedIds, disabled, onSelect }: Props) {
  if (!servers.length) return null;

  return (
    <section aria-label="Streaming servers">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-txt-faint">Servers</p>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-txt-muted">
          Manual selection
        </span>
      </div>
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Choose a server">
        {servers.map((server) => {
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
                isFailed && "cursor-not-allowed border-crimson-500/25 bg-crimson-500/[0.06] text-txt-faint opacity-60 hover:border-crimson-500/25",
                unavailable && !isFailed && "cursor-not-allowed opacity-45",
                !isDisabled && "active:scale-[0.97]"
              )}
            >
              {isFailed ? (
                <Ban className="h-4 w-4 text-crimson-400/80" aria-hidden />
              ) : unavailable ? (
                <ServerOff className="h-4 w-4" aria-hidden />
              ) : server.embedOnly ? (
                <Frame className="h-4 w-4" aria-hidden />
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
