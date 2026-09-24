import Link from "next/link";
import { SITE_NAME } from "@/utils/cn";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME} home`}
      className={`group flex items-center gap-2.5 ${className}`}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-crimson-500 shadow-glow-sm transition-transform duration-300 ease-premium group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 translate-x-[1px]" width="18" height="18" aria-hidden>
          <path d="M8 5.5v13a1.2 1.2 0 0 0 1.83 1.02l10.2-6.5a1.2 1.2 0 0 0 0-2.04L9.83 4.48A1.2 1.2 0 0 0 8 5.5z" fill="#fff" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-[0.18em] text-txt">
        {SITE_NAME}
      </span>
    </Link>
  );
}
