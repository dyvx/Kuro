import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/anime/", "/browse", "/genres", "/search"],
        disallow: ["/api/", "/watchlist", "/history", "/continue-watching", "/profile", "/login", "/register"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
