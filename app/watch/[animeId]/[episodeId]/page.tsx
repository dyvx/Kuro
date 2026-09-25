import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProvider } from "@/lib/anime/providers";
import { PlayerShell } from "@/components/player/player-shell";
import { EpisodePanel } from "@/components/episodes/episode-panel";
import { SITE_NAME, truncate } from "@/utils/cn";

export const dynamic = "force-dynamic";

interface Props {
  params: { animeId: string; episodeId: string };
}

/** Episode ids like "ep-7" / "slug-ep-7" carry the number inline — no provider call needed. */
function inlineEpisodeNumber(episodeId: string): number | null {
  const m = /(?:^|\/)ep-(\d+)$/.exec(episodeId) ?? /-ep-(\d+)$/.exec(episodeId);
  return m ? Number(m[1]) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const provider = getProvider();
  try {
    const details = await provider.getAnimeDetails(params.animeId);
    // Fast path: never block metadata on a (potentially slow) episode scrape.
    const number = inlineEpisodeNumber(params.episodeId);
    const title = details
      ? `Watch ${details.title} Episode ${number ?? 1}`
      : "Watch Episode";
    return {
      title,
      description: details
        ? truncate(`Stream ${details.title} episode ${number ?? 1} in HD with multiple servers, ad-free on ${SITE_NAME}. ${details.description}`, 200)
        : undefined,
      openGraph: {
        title,
        images: details?.banner || details?.image ? [{ url: (details.banner || details.image)! }] : undefined,
      },
      alternates: { canonical: `/watch/${params.animeId}/${params.episodeId}` },
    };
  } catch {
    return { title: "Watch" };
  }
}

export default async function WatchPage({ params }: Props) {
  const provider = getProvider();
  const details = await provider.getAnimeDetails(params.animeId).catch(() => null);
  if (!details) notFound();

  // Fast path — the episode number is embedded in the URL, and the panel
  // loads the episode list client-side (with skeletons) so the watch page
  // renders instantly even while the provider is still scraping.
  const inlineNumber = inlineEpisodeNumber(params.episodeId);
  if (inlineNumber !== null) {
    const n = inlineNumber;
    const base = `/watch/${details.id}`;
    return (
      <div className="mx-auto w-full max-w-[1500px] px-0 pb-24 md:px-6 md:pt-20">
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="min-w-0 flex-1">
            <PlayerShell
              providerId={provider.id}
              animeId={details.id}
              animeTitle={details.title}
              animeImage={details.image}
              episodeId={params.episodeId}
              episodeNumber={n}
              episodeTitle={null}
              nextHref={`${base}/ep-${n + 1}`}
            />

            <div className="px-4 pt-4 md:px-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-txt-faint">
                <Link href={`/anime/${details.id}`} className="transition-colors hover:text-primary-300">
                  {details.title}
                </Link>
                <span className="mx-2 text-line-strong" aria-hidden>
                  •
                </span>
                Episode {n}
              </p>
            </div>
          </div>

          <aside className="w-full shrink-0 xl:w-[380px] 2xl:w-[420px]">
            <EpisodePanel animeId={details.id} currentEpisodeId={params.episodeId} />
          </aside>
        </div>
      </div>
    );
  }

  // Legacy path (providers whose episode ids aren't numbered): resolve via
  // the full bundle. Providers here are metadata-fast, so SSR is fine.
  const bundle = await provider.getEpisodes(params.animeId).catch(() => ({ seasons: [], episodes: [] }));
  const episodes = bundle.episodes;
  if (!episodes.length) notFound();

  const index = episodes.findIndex((e) => e.id === params.episodeId);
  const current = index >= 0 ? episodes[index] : episodes[0];
  const prev = index > 0 ? episodes[index - 1] : null;
  const next = index >= 0 && index < episodes.length - 1 ? episodes[index + 1] : null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-0 pb-24 md:px-6 md:pt-20">
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          <PlayerShell
            providerId={provider.id}
            animeId={details.id}
            animeTitle={details.title}
            animeImage={details.image}
            episodeId={current.id}
            episodeNumber={current.number}
            episodeTitle={current.title ?? null}
            nextHref={next ? `/watch/${details.id}/${next.id}` : null}
          />

          <div className="px-4 pt-4 md:px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-txt-faint">
              <Link href={`/anime/${details.id}`} className="transition-colors hover:text-primary-300">
                {details.title}
              </Link>
              <span className="mx-2 text-line-strong" aria-hidden>
                •
              </span>
              Episode {current.number}
              {current.title ? (
                <>
                  <span className="mx-2 text-line-strong" aria-hidden>
                    •
                  </span>
                  <span className="normal-case tracking-normal">{current.title}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <aside className="w-full shrink-0 xl:w-[380px] 2xl:w-[420px]">
          <EpisodePanel
            animeId={details.id}
            currentEpisodeId={current.id}
            initialBundle={{ seasons: bundle.seasons, episodes }}
          />
        </aside>
      </div>
    </div>
  );
}
