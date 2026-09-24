"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Registration failed.");
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Incorrect email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail("demo@kuro.app");
    setPassword("kurodemo");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/14 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[420px] rounded-full bg-crimson-500/10 blur-[100px]" />
      </div>

      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 shadow-card-lg animate-scale-in">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-crimson-500 shadow-glow-sm">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M8 5.5v13a1.2 1.2 0 0 0 1.83 1.02l10.2-6.5a1.2 1.2 0 0 0 0-2.04L9.83 4.48A1.2 1.2 0 0 0 8 5.5z" fill="#fff" />
            </svg>
          </span>
          <span className="font-display text-xl font-bold tracking-[0.18em]">KURO</span>
        </Link>

        <h1 className="text-center font-display text-2xl font-bold text-txt">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-center text-sm text-txt-muted">
          {mode === "login"
            ? "Your episodes, exactly where you left them."
            : "Watchlists, resume playback and favorites — all synced."}
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-txt-faint">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                placeholder="Your name"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-txt-faint">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-txt-faint">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-crimson-500/30 bg-crimson-500/10 px-3.5 py-2.5 text-sm text-crimson-300">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {mode === "login" && (
          <button
            onClick={fillDemo}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-400/30 bg-primary-500/10 py-2.5 text-sm font-semibold text-primary-200 transition-colors hover:bg-primary-500/20"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Use demo account (demo@kuro.app)
          </button>
        )}

        <p className="mt-6 text-center text-sm text-txt-muted">
          {mode === "login" ? (
            <>
              New to KURO?{" "}
              <Link href="/register" className="font-semibold text-primary-300 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary-300 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
