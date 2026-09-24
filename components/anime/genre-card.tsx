import Link from "next/link";

const GRADIENTS: Record<string, string> = {
  Action: "from-red-500/70 via-primary-700/50 to-ink-900",
  Romance: "from-pink-500/70 via-purple-700/40 to-ink-900",
  Fantasy: "from-violet-500/70 via-indigo-700/40 to-ink-900",
  Psychological: "from-cyan-500/60 via-slate-700/40 to-ink-900",
  Isekai: "from-emerald-500/60 via-teal-700/40 to-ink-900",
  Shounen: "from-orange-500/70 via-amber-700/40 to-ink-900",
  Seinen: "from-slate-500/60 via-zinc-700/40 to-ink-900",
  Comedy: "from-yellow-500/60 via-orange-700/40 to-ink-900",
  Adventure: "from-lime-500/60 via-green-700/40 to-ink-900",
  Drama: "from-rose-500/60 via-red-900/40 to-ink-900",
  Horror: "from-neutral-500/50 via-red-950/60 to-ink-900",
  Mystery: "from-blue-500/60 via-slate-800/50 to-ink-900",
  "Sci-Fi": "from-sky-500/60 via-indigo-800/50 to-ink-900",
  Supernatural: "from-fuchsia-500/60 via-purple-900/50 to-ink-900",
  "Slice of Life": "from-teal-500/50 via-cyan-800/40 to-ink-900",
  Sports: "from-green-500/60 via-emerald-800/40 to-ink-900",
  Music: "from-purple-500/60 via-violet-800/40 to-ink-900",
  Thriller: "from-zinc-500/50 via-gray-800/50 to-ink-900",
  Ecchi: "from-pink-400/50 via-rose-800/40 to-ink-900",
  Mecha: "from-stone-500/50 via-neutral-800/50 to-ink-900",
};

export function GenreCard({ name, count }: { name: string; count: number }) {
  const gradient = GRADIENTS[name] ?? "from-primary-600/60 via-purple-900/40 to-ink-900";
  return (
    <Link
      href={`/search?genre=${encodeURIComponent(name)}`}
      className="group relative flex h-28 flex-col justify-end overflow-hidden rounded-2xl border border-line p-4 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-primary-400/50 hover:shadow-glow sm:h-32"
    >
      <span className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80 transition-opacity duration-300 group-hover:opacity-100`} aria-hidden />
      <span className="absolute -right-4 -top-6 font-display text-7xl font-bold text-white/10 transition-transform duration-500 ease-premium group-hover:scale-110 group-hover:text-white/15" aria-hidden>
        {name.charAt(0)}
      </span>
      <span className="relative">
        <span className="block font-display text-lg font-bold text-white">{name}</span>
        <span className="text-xs font-medium text-white/60">{count > 0 ? `${count} titles` : "Explore"}</span>
      </span>
    </Link>
  );
}
