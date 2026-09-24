import Link from "next/link";
import { Ghost } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-kuro flex min-h-[70vh] flex-col items-center justify-center pt-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface-raised">
        <Ghost className="h-9 w-9 text-primary-300" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-6xl font-bold text-gradient">404</h1>
      <p className="mt-3 font-display text-xl font-bold text-txt">This episode doesn&apos;t exist</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-txt-muted">
        The page you&apos;re looking for was moved, removed, or never existed in this timeline.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-xl bg-brand-gradient px-6 text-sm font-bold text-white shadow-glow-sm transition-all hover:shadow-glow"
        >
          Back home
        </Link>
        <Link
          href="/browse"
          className="inline-flex h-11 items-center rounded-xl border border-line px-6 text-sm font-bold text-txt-muted transition-colors hover:border-primary-400/40 hover:text-primary-200"
        >
          Browse anime
        </Link>
      </div>
    </div>
  );
}
