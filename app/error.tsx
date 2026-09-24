"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[kuro] page error:", error);
  }, [error]);

  return (
    <div className="container-kuro flex min-h-[70vh] flex-col items-center justify-center pt-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-crimson-500/30 bg-crimson-500/10">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-crimson-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold text-txt">Something broke the stream</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-txt-muted">
        An unexpected error occurred. This is usually temporary — try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-gradient px-6 text-sm font-bold text-white shadow-glow-sm transition-all hover:shadow-glow"
      >
        <RotateCw className="h-4 w-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
