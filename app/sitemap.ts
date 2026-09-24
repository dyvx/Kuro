import type { MetadataRoute } from "next";
import { getProvider } from "@/lib/anime/providers";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/browse",
    "/genres",
    "/search",
    "/watchlist",
    "/history",
    "/continue-watching",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.6,
  }));

  try {
    const provider = getProvider();
    const trending = await provider.getTrendingAnime(1, 30);
    const animeRoutes: MetadataRoute.Sitemap = trending.map((a) => ({
      url: `${base}/anime/${a.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticRoutes, ...animeRoutes];
  } catch {
    return staticRoutes;
  }
}
