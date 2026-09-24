import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, CalendarDays, Sparkles, Clock3, Clapperboard } from "lucide-react";
import { getProvider } from "@/lib/anime/providers";
import { Poster } from "@/components/anime/poster";
import { WatchlistButton, FavoriteButton } from "@/components/anime/watchlist-button";
import { EpisodeBrowser } from "@/components/episodes/episode-browser";
import { EmptyState } from "@/components/states";
import { SITE_NAME, truncate } from "@/utils/cn";
import type { EpisodeBundle } from "@/types/anime";

export const revalidate = 600;

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = getProvider();
  try {
    const details = await provider.getAnimeDetails(params.id);
    if (!details) return { title: "Anime not found" };
    const description = truncate(details.description, 160) || `Watch ${details.title} on ${SITE_NAME}.`;
    return {
      title: details.title,
      description,
      openGraph: {
        title: `${details.title} — ${SITE_NAME}`,
        description,
        type: "video.tv_show",
        images: details.banner || details.image ? [{ url: (details.banner || details.image)! }] : undefined,
      },
      twitter: { card: "summary_large_image", title: details.title, description },
      alternates: { canonical: `/anime/${details.id}` },
    };
  } catch {
    return { title: "Anime" };
  }
}

export default async function AnimeDetailsPage({ params }: Props) {
  const provider = getProvider();
  const details = await provider.getAnimeDetails(params.id).catch(() => null);
  if (!details) notFound();

  const bundle: EpisodeBundle = await provider.getEpisodes(params.id).catch(() => ({ seasons: [], episodes: [] }));

  const backdrop = details.banner || details.image;

  return (
    <article>
      {/* ── Cinematic backdrop header ── */}
      <header className="relative -mt-16">
        <div className="absolute inset-0 overflow-hidden">
          {backdrop && (
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-hero-fade" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-bottom-fade" />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />
        </div>

        <div className="container-kuro relative pb-10 pt-32 sm:pt-40">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end">
            <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-3xl border border-white/10 shadow-card-lg sm:mx-0 sm:w-52 lg:w-60">
              <Poster src={details.image} alt={details.title} color={details.color} priority />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-shadow-hero font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                {details.title}
              </h1>
              {details.japaneseTitle && (
                <p className="mt-1.5 text-sm text-white/60">{details.japaneseTitle}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/85 sm:justify-start">
                {details.rating != null && (
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Star className="h-4 w-4 fill-amber-300" aria-hidden />
                    {details.rating.toFixed(1)}
                    <span className="text-xs font-normal text-white/50">/ 10</span>
                  </span>
                )}
                {details.year && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-white/50" aria-hidden />
                    {details.year}
                  </span>
                )}
                <span className="rounded-lg border border-white/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                  {details.type}
                </span>
                <StatusPill status={details.status} />
                {details.totalEpisodes > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-white/50" aria-hidden />
                    {details.totalEpisodes} eps
                  </span>
                )}
                {details.duration && (
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 text-white/50" aria-hidden />
                    {details.duration} min
                  </span>
                )}
                {details.studio && (
                  <span className="flex items-center gap-1.5">
                    <Clapperboard className="h-4 w-4 text-white/50" aria-hidden />
                    {details.studio}
                  </span>
                )}
              </div>

              {details.genres && details.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {details.genres.map((g) => (
                    <Link
                      key={g}
                      href={`/search?genre=${encodeURIComponent(g)}`}
                      className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-primary-400/50 hover:text-primary-200"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <Link
                  href={`/watch/${details.id}/1`}
                  className="inline-flex h-12 items-center gap-2.5 rounded-2xl bg-brand-gradient px-7 text-[15px] font-bold text-white shadow-glow transition-all duration-300 hover:scale-[1.03] hover:shadow-glow active:scale-95"
                >
                  <PlayIcon />
                  Start Watching
                </Link>
                <WatchlistButton
                  anime={{
                    id: details.id,
                    title: details.title,
                    image: details.image,
                    type: details.type,
                    year: details.year,
                    rating: details.rating,
                  }}
                />
                <FavoriteButton
                  anime={{
                    id: details.id,
                    title: details.title,
                    image: details.image,
                    type: details.type,
                    year: details.year,
                    rating: details.rating,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Synopsis + episodes ── */}
      <div className="container-kuro pb-16">
        <section className="mt-2 max-w-3xl">
          <h2 className="mb-3 font-display text-xl font-bold text-txt">Synopsis</h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-txt-muted">
            {details.description || "No synopsis available for this title yet."}
          </p>
        </section>

        <section className="mt-10" aria-label="Episodes">
          {bundle.episodes.length > 0 ? (
            <EpisodeBrowser
              animeId={details.id}
              animeTitle={details.title}
              seasons={bundle.seasons}
              episodes={bundle.episodes}
            />
          ) : (
            <EmptyState
              title="No episodes listed"
              description="This provider hasn't published an episode list for this title yet."
            />
          )}
        </section>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status?: string }) {
  const map: Record<string, { label: string; dot: string }> = {
    RELEASING: { label: "Airing", dot: "bg-emerald-400" },
    FINISHED: { label: "Completed", dot: "bg-white/60" },
    UPCOMING: { label: "Upcoming", dot: "bg-sky-400" },
    HIATUS: { label: "Hiatus", dot: "bg-amber-400" },
    CANCELLED: { label: "Cancelled", dot: "bg-crimson-400" },
  };
  const s = map[status ?? ""] ?? { label: status ?? "Unknown", dot: "bg-white/60" };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M8 5.5v13a1.2 1.2 0 0 0 1.83 1.02l10.2-6.5a1.2 1.2 0 0 0 0-2.04L9.83 4.48A1.2 1.2 0 0 0 8 5.5z" />
    </svg>
  );
}
