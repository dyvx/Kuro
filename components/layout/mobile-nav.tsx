"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Clock, Compass, Home, Search, User } from "lucide-react";
import { cn } from "@/utils/cn";

/* Mobile gets its own carefully designed chrome: a bottom tab bar
   (hidden on the watch page so the player owns the whole screen). */

const TABS = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const hidden =
    pathname?.startsWith("/watch/") || pathname === "/login" || pathname === "/register";
  if (hidden) return null;

  return (
    <nav
      aria-label="Mobile"
      className="glass-strong fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-[56px] flex-col items-center justify-center gap-1 py-2"
              >
                <tab.icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-primary-300" : "text-txt-faint"
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-wide transition-colors",
                    active ? "text-primary-200" : "text-txt-faint"
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-0 h-0.5 w-8 rounded-full bg-brand-gradient transition-opacity",
                    active ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
