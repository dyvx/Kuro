"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bookmark, Clock, Heart, History, LogIn, LogOut, Settings, User } from "lucide-react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (status === "loading") {
    return <div className="skeleton h-9 w-9 rounded-full" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-glow-sm transition-all duration-200 hover:shadow-glow hover:brightness-110"
      >
        <LogIn className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const initial = (session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase();
  const items = [
    { href: "/profile", label: "Profile", icon: User },
    { href: "/continue-watching", label: "Continue Watching", icon: Clock },
    { href: "/watchlist", label: "Watchlist", icon: Bookmark },
    { href: "/history", label: "History", icon: History },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-crimson-500 text-sm font-bold text-white shadow-glow-sm transition-transform duration-200 hover:scale-105"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="glass-strong absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl p-2 shadow-card-lg animate-scale-in"
        >
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-txt">{session.user.name}</p>
            <p className="truncate text-xs text-txt-faint">{session.user.email}</p>
          </div>
          <ul className="py-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-txt-muted transition-colors hover:bg-white/5 hover:text-txt"
                >
                  <item.icon className="h-4 w-4 text-primary-300" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-1">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-crimson-400 transition-colors hover:bg-crimson-500/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
