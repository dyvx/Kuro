"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Compass, LayoutGrid, Search, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";
import { cn } from "@/utils/cn";

const LINKS = [
  { href: "/", label: "Home", icon: Sparkles },
  { href: "/browse", label: "Browse", icon: LayoutGrid },
  { href: "/genres", label: "Genres", icon: Compass },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const { status } = useSession();

  // The watch page is player-first — keep chrome minimal there.
  const isWatch = pathname?.startsWith("/watch/");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isAuthPage) return null;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[70] transition-all duration-300 ease-premium",
        // On phones the watch page is player-first: the player owns the top
        // of the screen, so the whole navbar gets out of the way there.
        isWatch && "hidden md:block",
        scrolled
          ? "glass-strong shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent"
      )}
    >
      <nav className="container-kuro flex h-16 items-center gap-3 sm:gap-6" aria-label="Main">
        <Logo className={cn(isWatch && "hidden sm:flex")} />

        {!isWatch && (
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-200",
                    active ? "bg-primary-500/15 text-primary-200" : "text-txt-muted hover:bg-white/5 hover:text-txt"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className={cn("min-w-0 flex-1", isWatch && "flex justify-end")}>
          {/* Full quick-search only from sm up — on phones the bottom tab
              bar's Search page (plus this compact icon) covers it without
              squeezing the navbar. */}
          <div className="ml-auto hidden w-full max-w-md sm:block">
            <SearchBar />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isWatch && (
            <Link
              href="/search"
              aria-label="Search anime"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-txt-muted transition-colors hover:bg-white/5 hover:text-txt sm:hidden"
            >
              <Search className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <Link
            href="/watchlist"
            className={cn(
              "hidden rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors md:block",
              pathname?.startsWith("/watchlist")
                ? "bg-primary-500/15 text-primary-200"
                : "text-txt-muted hover:bg-white/5 hover:text-txt"
            )}
          >
            Watchlist
          </Link>
          {status !== "loading" && <UserMenu />}
        </div>
      </nav>
    </header>
  );
}
