import { getProvider } from "@/lib/anime/providers";
import { loadSection } from "@/lib/anime/sections";
import { HeroBanner } from "@/components/anime/hero-banner";
import { LazySection } from "@/components/anime/lazy-section";
import { ContinueWatchingLazy } from "@/components/home/continue-watching-lazy";
import { HeroSkeleton } from "@/components/ui/skeleton";
import type { AnimeDetails } from "@/types/anime";

export const revalidate = 3600;

type HeroAnime = AnimeDetails & { featuredLabel?: string };

export default async function HomePage() {
  const provider = getProvider();

  const trending = await loadSection("trending", 12);
  const heroItems: HeroAnime[] = (
    await Promise.all(
      trending.slice(0, 5).map(async (t) => {
        try {
          return await provider.getAnimeDetails(t.id);
        } catch {
          return null;
        }
      })
    )
  )
    .filter((d): d is AnimeDetails => d !== null)
    .slice(0, 5)
    .map((d, i) => ({
      ...d,
      featuredLabel: i === 0 ? "#1 Spotlight this week" : `Featured · #${i + 1}`,
    }));

  return (
    <div className="pb-4">
      {heroItems.length > 0 ? <HeroBanner items={heroItems} /> : <HeroSkeleton />}

      <div className="container-kuro -mt-2">
        <ContinueWatchingLazy />

        <div className="mt-10 space-y-14">
          <LazySection title="Trending Now" slug="trending" ranked viewAllHref="/search?sort=TRENDING" />
          <LazySection
            title="Fresh Episodes"
            slug="recent-updated"
            viewAllHref="/browse?sort=NEWEST"
            subtitle="Newly aired from currently airing series"
          />
          <LazySection title="Popular Anime" slug="popular" viewAllHref="/search?sort=POPULARITY" />
          <LazySection title="Most Watched" slug="most-watched" viewAllHref="/search?sort=POPULARITY" />
          <LazySection title="Recently Added" slug="recent-added" viewAllHref="/search?sort=NEWEST" />

          <div className="h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" aria-hidden />

          <LazySection title="Action" slug="action" viewAllHref="/search?genre=Action" />
          <LazySection title="Romance" slug="romance" viewAllHref="/search?genre=Romance" />
          <LazySection title="Fantasy" slug="fantasy" viewAllHref="/search?genre=Fantasy" />
          <LazySection title="Psychological" slug="psychological" viewAllHref="/search?genre=Psychological" />
          <LazySection title="Isekai" slug="isekai" viewAllHref="/search?genre=Isekai" />
          <LazySection title="Shounen" slug="shounen" viewAllHref="/search?genre=Shounen" />
          <LazySection title="Seinen" slug="seinen" viewAllHref="/search?genre=Seinen" />
        </div>
      </div>
    </div>
  );
}
