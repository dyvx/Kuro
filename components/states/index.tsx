"use client";

import { RotateCw, Ghost, WifiOff, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/* Reusable Loading / Empty / Error states — never a blank screen. */

export function RetryButton({ onRetry, label = "Try again" }: { onRetry: () => void; label?: string }) {
  return (
    <Button variant="secondary" onClick={onRetry} className="mt-5">
      <RotateCw className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)} role="status">
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary-500/25 border-t-primary-400" />
      </span>
      <p className="text-sm text-txt-muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  variant = "ghost",
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "ghost" | "search" | "network";
  className?: string;
}) {
  const Icon = variant === "search" ? SearchX : variant === "network" ? WifiOff : Ghost;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line px-8 py-16 text-center",
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-brand-gradient-soft blur-xl" aria-hidden />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface-raised">
          <Icon className="h-7 w-7 text-primary-300" aria-hidden />
        </div>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold text-txt">{title}</h3>
      {description && <p className="max-w-md text-sm leading-relaxed text-txt-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-crimson-500/20 bg-crimson-500/[0.04] px-8 py-14 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-crimson-500/30 bg-crimson-500/10">
        <WifiOff className="h-6 w-6 text-crimson-400" aria-hidden />
      </div>
      <h3 className="mt-1 font-display text-lg font-semibold text-txt">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-txt-muted">
        {description ?? "The content provider didn't respond. This is usually temporary."}
      </p>
      {onRetry && <RetryButton onRetry={onRetry} />}
    </div>
  );
}
