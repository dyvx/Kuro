import { cached } from "./cache";
import { getProvider } from "./providers";
import type { AnimeCardItem, SectionSlug } from "@/types/anime";
import { SECTION_GENRES } from "@/types/anime";

/* Server-side section loaders with caching. Homepage sections and
   browse pages all funnel through here so upstream traffic stays low. */

export async function loadSection(slug: SectionSlug["slug"], perPage = 18): Promise<AnimeCardItem[]> {
  return cached(`section:${slug}:${perPage}`, 10 * 60_000, async () => {
    const provider = getProvider();
    const genre = SECTION_GENRES[slug];
    try {
      switch (slug) {
        case "trending":
          return await provider.getTrendingAnime(1, perPage);
        case "popular":
          return await provider.getPopularAnime(1, perPage);
        case "recent-updated":
          return await provider.getRecentlyUpdated(1, perPage);
        case "recent-added":
          return await provider.getRecentlyAdded(1, perPage);
        case "most-watched":
          return await provider.getMostWatched(1, perPage);
        default:
          if (genre) return await provider.getByGenre(genre, 1, perPage);
          return [];
      }
    } catch (err) {
      console.error(`[kuro] section "${slug}" failed:`, err);
      return [];
    }
  });
}
