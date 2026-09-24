"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Compass, LayoutGrid, Sparkles } from "lucide-react";
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
        scrolled
          ? "glass-strong shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent"
      )}
    >
      <nav className="container-kuro flex h-16 items-center gap-6" aria-label="Main">
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
          <div className="ml-auto w-full max-w-md">
            <SearchBar />
          </div>
        </div>

        <div className="flex items-center gap-2">
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
