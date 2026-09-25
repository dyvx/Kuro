"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import {
  Bookmark, Camera, CheckCircle2, Clapperboard, Flame, Heart, LoaderCircle, LogOut,
  Pencil, Play, Star, Trophy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/states";
import { useToast } from "@/components/ui/toast";
import { loadPrefs, savePrefs, type PlayerPrefs } from "@/lib/player/player-types";
import { formatRelative } from "@/utils/cn";
import { cn } from "@/utils/cn";

/* ────────────────────────────────────────────────────────────────
   KURO PROFILE — banner, avatar, stats, achievements, continue.
   All numbers come from /api/me/stats (server-computed, real data).
   ──────────────────────────────────────────────────────────────── */

interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  avatar: string | null;
  accent: string;
}

interface Stats {
  animeCount: number;
  episodeCount: number;
  watchHours: number;
  completedCount: number;
  watchingCount: number;
  watchlistCount: number;
  favoritesCount: number;
  topGenres: { genre: string; count: number }[];
  recentlyWatched: { animeId: string; title: string; image: string | null; episodeNumber: number; updatedAt: string }[];
  longestCompleted: { animeId: string; title: string; episodes: number } | null;
  streakDays: number;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  target: number;
}

interface ContinueItem {
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  resumeEpisodeId: string;
  resumeEpisodeNumber: number;
  episodeNumber: number;
  percent: number;
  movingToNext: boolean;
}

const ACCENT_GRADIENTS: Record<string, string> = {
  violet: "from-violet-600 via-purple-600 to-fuchsia-600",
  crimson: "from-crimson-500 via-rose-600 to-red-700",
  azure: "from-sky-500 via-blue-600 to-indigo-600",
  emerald: "from-emerald-500 via-teal-600 to-cyan-600",
  amber: "from-amber-400 via-orange-500 to-rose-500",
  rose: "from-pink-500 via-rose-500 to-fuchsia-600",
};

const SEEN_KEY = "kuro-achievements-seen:v1";

export function ProfileClient() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [autoplay, setAutoplay] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setAutoplay(loadPrefs().autoplayNext);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).then((json) => {
      if (json) setProfile(json.profile);
    }).catch(() => {});
    fetch("/api/me/stats").then((r) => (r.ok ? r.json() : null)).then((json) => {
      if (!json) return;
      setStats(json.stats);
      setAchievements(json.achievements ?? []);
      // Celebrate unlocks the user hasn't seen yet — subtle toast, no popups.
      try {
        const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
        const fresh = (json.newlyUnlocked ?? []).filter((id: string) => !seen.has(id));
        for (const a of json.achievements as Achievement[]) {
          if (fresh.includes(a.id)) {
            toast(`${a.icon} Achievement unlocked — ${a.title}!`, "success", 5000);
          }
        }
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...(json.newlyUnlocked ?? [])]));
      } catch {
        /* non-fatal */
      }
    }).catch(() => {});
    fetch("/api/continue").then((r) => (r.ok ? r.json() : null)).then((json) => {
      if (json) setContinueItems((json.items ?? []).slice(0, 3));
    }).catch(() => {});
  }, [status, toast]);

  if (status === "loading") return <LoadingState className="pt-32" label="Loading profile…" />;

  if (status === "unauthenticated") {
    return (
      <div className="container-kuro pt-32 text-center md:pt-28">
        <h1 className="font-display text-2xl font-bold text-txt">You&apos;re browsing as a guest</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-txt-muted">
          Sign in to unlock your profile, stats, achievements, watchlists, resume playback, and cross-device sync.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login?callbackUrl=/profile"><Button>Sign in</Button></Link>
          <Link href="/register"><Button variant="secondary">Create account</Button></Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.displayName || session?.user?.name || "Viewer";
  const username = profile?.username || (session?.user?.email ?? "").split("@")[0] || "viewer";
  const accent = profile?.accent && ACCENT_GRADIENTS[profile.accent] ? profile.accent : "violet";

  return (
    <div className="container-kuro max-w-4xl pb-24">
      {/* ── premium profile header ── */}
      <header className="relative -mx-4 overflow-hidden sm:-mx-6 sm:rounded-b-3xl md:-mx-10">
        <div className={cn("relative h-36 bg-gradient-to-br sm:h-44", ACCENT_GRADIENTS[accent])} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(600px_200px_at_70%_0%,rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>

        <div className="relative -mt-10 px-4 pb-5 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <span className={cn("relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-ink-950 bg-gradient-to-br shadow-card-lg sm:h-24 sm:w-24", ACCENT_GRADIENTS[accent])}>
              {profile?.avatar ? (
                <Image src={profile.avatar} alt="" width={96} height={96} className="h-full w-full object-cover" unoptimized />
              ) : (
                <span className="font-display text-3xl font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </span>
            <button
              onClick={() => setEditOpen(true)}
              className="mb-1 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3.5 text-xs font-bold text-txt-muted backdrop-blur transition-colors hover:border-primary-400/50 hover:text-primary-200"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit profile
            </button>
          </div>

          <div className="mt-3">
            <h1 className="font-display text-2xl font-bold text-txt sm:text-3xl">{displayName}</h1>
            <p className="text-sm font-semibold text-primary-300">@{username}</p>
            {profile?.bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-txt-muted">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-txt-muted">
              <span className="flex items-center gap-1.5"><Clapperboard className="h-3.5 w-3.5 text-primary-300" aria-hidden />{stats?.animeCount ?? "—"} anime</span>
              <span className="flex items-center gap-1.5"><Play className="h-3.5 w-3.5 text-primary-300" aria-hidden />{stats?.episodeCount ?? "—"} episodes</span>
              {stats && stats.streakDays > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Flame className="h-3.5 w-3.5" aria-hidden />{stats.streakDays}-day streak
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── continue watching preview ── */}
      {continueItems.length > 0 && (
        <section className="mt-8" aria-label="Continue watching">
          <SectionHeading title="Continue Watching" href="/continue-watching" />
          <ul className="grid gap-3 sm:grid-cols-3">
            {continueItems.map((c) => (
              <li key={c.animeId}>
                <Link
                  href={`/watch/${c.animeId}/${c.resumeEpisodeId}`}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-400/40"
                >
                  <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    {c.animeImage && <Image src={c.animeImage} alt="" fill sizes="40px" className="object-cover" unoptimized />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-txt">{c.animeTitle}</span>
                    <span className="block text-[11px] font-semibold text-primary-300">
                      {c.movingToNext ? `EP ${c.resumeEpisodeNumber}` : `EP ${c.episodeNumber}`} · {c.percent}%
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-brand-gradient" style={{ width: `${c.percent}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── watching stats ── */}
      <section className="mt-10" aria-label="Watching stats">
        <SectionHeading title="KURO Stats" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Clapperboard className="h-4 w-4" />} value={stats?.animeCount} label="Anime" delay={0} />
          <StatCard icon={<Play className="h-4 w-4" />} value={stats?.episodeCount} label="Episodes" delay={60} />
          <StatCard icon={<Star className="h-4 w-4" />} value={stats ? `${stats.watchHours}h` : undefined} label="Watch Time" delay={120} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} value={stats?.completedCount} label="Completed" delay={180} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MiniStat icon={<Bookmark className="h-4 w-4 text-primary-300" />} label="In progress" value={stats?.watchingCount} />
          <MiniStat icon={<Bookmark className="h-4 w-4 text-primary-300" />} label="Watchlist" value={stats?.watchlistCount} />
          <MiniStat icon={<Heart className="h-4 w-4 text-crimson-400" />} label="Favorites" value={stats?.favoritesCount} />
        </div>

        {(stats?.topGenres.length || stats?.longestCompleted) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {stats.topGenres.length > 0 && (
              <div className="rounded-2xl border border-line bg-surface/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-txt-faint">Most watched genres</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {stats.topGenres.map((g) => (
                    <span key={g.genre} className="rounded-full border border-primary-400/25 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-200">
                      {g.genre} <span className="text-primary-300/60">×{g.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {stats.longestCompleted && (
              <div className="rounded-2xl border border-line bg-surface/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-txt-faint">Longest completed</p>
                <Link href={`/anime/${stats.longestCompleted.animeId}`} className="mt-2 block truncate text-sm font-bold text-txt hover:text-primary-200">
                  {stats.longestCompleted.title}
                </Link>
                <p className="text-xs text-txt-muted">{stats.longestCompleted.episodes} episodes</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── achievements ── */}
      <section className="mt-10" aria-label="Achievements">
        <SectionHeading title="Achievements" subtitle={`${achievements.filter((a) => a.unlocked).length} of ${achievements.length} unlocked`} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {achievements.map((a, i) => (
            <li
              key={a.id}
              className={cn(
                "rounded-2xl border p-3.5 text-center transition-all duration-300",
                a.unlocked
                  ? "border-amber-400/30 bg-gradient-to-b from-amber-400/[0.08] to-transparent"
                  : "border-line bg-surface/40"
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className={cn("block text-2xl", !a.unlocked && "opacity-35 grayscale")} aria-hidden>{a.icon}</span>
              <p className={cn("mt-1.5 text-xs font-bold", a.unlocked ? "text-txt" : "text-txt-muted")}>{a.title}</p>
              {a.unlocked ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" aria-hidden /> Unlocked
                </p>
              ) : (
                <p className="mt-1 text-[10px] font-bold text-txt-faint">{a.progress} / {a.target}</p>
              )}
              {!a.unlocked && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-primary-500/50" style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }} />
                </div>
              )}
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-txt-faint">{a.description}</p>
              {a.unlocked && a.unlockedAt && (
                <p className="mt-0.5 text-[9px] text-txt-faint">{formatRelative(a.unlockedAt)}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── recently watched ── */}
      {stats && stats.recentlyWatched.length > 0 && (
        <section className="mt-10" aria-label="Recently watched">
          <SectionHeading title="Recently Watched" href="/history" />
          <ul className="space-y-2">
            {stats.recentlyWatched.slice(0, 5).map((r) => (
              <li key={r.animeId}>
                <Link
                  href={`/watch/${r.animeId}/ep-${r.episodeNumber}`}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-white/[0.03]"
                >
                  <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    {r.image && <Image src={r.image} alt="" fill sizes="36px" className="object-cover" unoptimized />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-txt group-hover:text-primary-200">{r.title}</span>
                    <span className="block text-[11px] text-txt-faint">EP {r.episodeNumber} · {formatRelative(r.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── preferences + quick links ── */}
      <section className="mt-10 rounded-2xl border border-line bg-surface/60 p-5">
        <h2 className="font-display text-lg font-bold text-txt">Preferences</h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between">
          <span className="flex items-center gap-2.5 text-sm text-txt">
            <Play className="h-4 w-4 text-primary-300" aria-hidden />
            Autoplay next episode
          </span>
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => {
              setAutoplay(e.target.checked);
              const prefs: PlayerPrefs = { ...loadPrefs(), autoplayNext: e.target.checked };
              savePrefs(prefs);
            }}
            className="h-4 w-4 accent-[#8b5cf6]"
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-txt-faint">
          When an episode ends, jump straight into the next one. You can also toggle this from the
          player settings menu.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link href="/watchlist"><Button variant="secondary" size="sm">Watchlist</Button></Link>
          <Link href="/history"><Button variant="secondary" size="sm">History</Button></Link>
          <Link href="/continue-watching"><Button variant="secondary" size="sm">Continue Watching</Button></Link>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-crimson-400 hover:bg-crimson-500/10"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </section>

      {editOpen && (
        <EditProfileModal
          profile={profile}
          fallbackName={displayName}
          fallbackUsername={username}
          onClose={() => setEditOpen(false)}
          onSaved={(p) => {
            setProfile(p);
            setEditOpen(false);
            toast("Profile updated.", "success");
          }}
        />
      )}
    </div>
  );
}

/* ── stat cards ─────────────────────────────────────────────── */

function StatCard({ icon, value, label, delay }: { icon: React.ReactNode; value: number | string | undefined; label: string; delay: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface/60 p-4 transition-all duration-500 ease-premium",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500/12 text-primary-300" aria-hidden>
        {icon}
      </span>
      <p className="mt-2.5 font-display text-2xl font-bold tabular-nums text-txt">
        {value === undefined ? "—" : value}
      </p>
      <p className="text-xs font-semibold text-txt-faint">{label}</p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05]" aria-hidden>{icon}</span>
      <span>
        <span className="block font-display text-lg font-bold leading-tight text-txt">{value ?? "—"}</span>
        <span className="text-[11px] font-semibold text-txt-faint">{label}</span>
      </span>
    </div>
  );
}

function SectionHeading({ title, href, subtitle }: { title: string; href?: string; subtitle?: string }) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold text-txt">{title}</h2>
        {subtitle && <p className="text-xs text-txt-faint">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="text-xs font-bold text-txt-muted transition-colors hover:text-primary-300">
          View all →
        </Link>
      )}
    </div>
  );
}

/* ── edit modal (avatar upload + resize, name, username, bio, accent) ── */

function EditProfileModal({
  profile,
  fallbackName,
  fallbackUsername,
  onClose,
  onSaved,
}: {
  profile: UserProfile | null;
  fallbackName: string;
  fallbackUsername: string;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.displayName || fallbackName);
  const [username, setUsername] = useState(profile?.username || fallbackUsername);
  const [bio, setBio] = useState(profile?.bio || "");
  const [accent, setAccent] = useState(profile?.accent || "violet");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = useCallback(async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Avatar must be a PNG, JPEG or WebP image.");
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 256);
      setAvatar(dataUrl);
      setError(null);
    } catch {
      setError("Couldn't process that image — try another.");
    }
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, username: username.toLowerCase(), bio, accent, avatar }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed.");
      onSaved(json.profile as UserProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div className="glass-strong relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 shadow-card-lg animate-scale-in sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-txt">Edit profile</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-txt-muted hover:bg-white/5 hover:text-txt">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* avatar */}
        <div className="flex items-center gap-4">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-crimson-500">
            {avatar ? (
              <Image src={avatar} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span className="font-display text-2xl font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
            )}
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3.5 text-xs font-bold text-txt-muted transition-colors hover:border-primary-400/50 hover:text-primary-200"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {avatar ? "Change photo" : "Upload photo"}
            </button>
            {avatar && (
              <button onClick={() => setAvatar(null)} className="text-left text-[11px] font-semibold text-txt-faint hover:text-crimson-400">
                Remove photo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickAvatar(f);
                e.target.value = "";
              }}
            />
            <p className="text-[10px] text-txt-faint">Resized to 256px on your device before upload.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3.5">
          <Field label={`Display name (${displayName.length}/40)`}>
            <input className={inputCls} value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Username">
            <div className="flex items-center gap-2">
              <span className="text-sm text-txt-faint">@</span>
              <input className={inputCls} value={username} maxLength={20} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="lowercase_letters" />
            </div>
          </Field>
          <Field label={`Bio (${bio.length}/200)`}>
            <textarea className={cn(inputCls, "min-h-[72px] resize-none py-2")} value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} placeholder="Tell KURO about your taste…" />
          </Field>
          <Field label="Accent">
            <div className="flex flex-wrap gap-2">
              {Object.keys(ACCENT_GRADIENTS).map((a) => (
                <button
                  key={a}
                  onClick={() => setAccent(a)}
                  aria-label={`Accent ${a}`}
                  aria-pressed={accent === a}
                  className={cn(
                    "h-8 w-8 rounded-full bg-gradient-to-br transition-all",
                    ACCENT_GRADIENTS[a],
                    accent === a ? "scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-ink-950" : "opacity-70 hover:opacity-100"
                  )}
                />
              ))}
            </div>
          </Field>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-crimson-500/30 bg-crimson-500/10 px-3.5 py-2.5 text-sm text-crimson-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Trophy className="h-4 w-4" aria-hidden />}
            Save profile
          </Button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-ink-900/70 px-3 text-sm text-txt outline-none transition-colors hover:border-line-strong focus:border-primary-400/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-txt-faint">{label}</span>
      {children}
    </label>
  );
}

/** Downscale + JPEG-compress an image file entirely on the client. */
function resizeImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
