import Link from "next/link";
import { getProviderDisplay } from "@/lib/anime/providers";
import { SITE_NAME, SITE_TAGLINE } from "@/utils/cn";

export function Footer() {
  const provider = getProviderDisplay();
  return (
    <footer className="mt-24 border-t border-line pb-24 md:pb-10">
      <div className="container-kuro flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold tracking-[0.18em] text-txt">{SITE_NAME}</p>
          <p className="mt-2 text-sm leading-relaxed text-txt-muted">{SITE_TAGLINE}. A premium, ad-free way to discover and watch anime.</p>
          <p className="mt-4 text-xs leading-relaxed text-txt-faint">
            Demo build — all series belong to their respective owners. Content is provided by a
            configurable third-party metadata provider; this deployment currently uses the
            {" "}<span className="text-primary-300">{provider.name}</span> catalog.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div>
            <p className="mb-3 font-semibold text-txt">Discover</p>
            <ul className="space-y-2 text-txt-muted">
              <li><Link className="transition-colors hover:text-primary-300" href="/browse">Browse</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/genres">Genres</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/search">Search</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-txt">Library</p>
            <ul className="space-y-2 text-txt-muted">
              <li><Link className="transition-colors hover:text-primary-300" href="/watchlist">Watchlist</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/continue-watching">Continue Watching</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/history">History</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 font-semibold text-txt">Account</p>
            <ul className="space-y-2 text-txt-muted">
              <li><Link className="transition-colors hover:text-primary-300" href="/profile">Profile</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/login">Sign in</Link></li>
              <li><Link className="transition-colors hover:text-primary-300" href="/register">Create account</Link></li>
            </ul>
          </div>
        </nav>
      </div>
    </footer>
  );
}
