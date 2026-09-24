import { NextResponse } from "next/server";
import { getProvider } from "@/lib/anime/providers";
import { cached } from "@/lib/anime/cache";
import type { AnimeType, AnimeStatus, SearchFilters, SortOption } from "@/types/anime";

export const dynamic = "force-dynamic";

const TYPES: AnimeType[] = ["TV", "Movie", "OVA", "ONA", "Special"];
const STATUSES: AnimeStatus[] = ["RELEASING", "FINISHED", "UPCOMING"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const genreParam = searchParams.get("genre") ?? "";
  const genres = genreParam ? genreParam.split(",").map((g) => g.trim()).filter(Boolean) : [];
  const typeRaw = searchParams.get("type") ?? "";
  const statusRaw = searchParams.get("status") ?? "";
  const yearRaw = searchParams.get("year") ?? "";
  const sortRaw = (searchParams.get("sort") ?? "TRENDING") as SortOption;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(48, Math.max(6, parseInt(searchParams.get("perPage") ?? "24", 10) || 24));

  const filters: SearchFilters = {
    query: q || undefined,
    genres,
    type: TYPES.includes(typeRaw as AnimeType) ? (typeRaw as AnimeType) : "",
    status: STATUSES.includes(statusRaw as AnimeStatus) ? (statusRaw as AnimeStatus) : "",
    year: yearRaw && !Number.isNaN(Number(yearRaw)) ? Number(yearRaw) : "",
    sort: (["TRENDING", "POPULARITY", "RATING", "NEWEST", "TITLE"] as SortOption[]).includes(sortRaw)
      ? sortRaw
      : "TRENDING",
    page,
    perPage,
  };

  const cacheKey = `search:${JSON.stringify(filters)}`;
  try {
    const provider = getProvider();
    const result = await cached(cacheKey, 3 * 60_000, () =>
      q || filters.genres?.length || filters.type || filters.year
        ? provider.advancedSearch(filters)
        : provider.advancedSearch({ ...filters, sort: filters.sort })
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[kuro] search failed:", err);
    return NextResponse.json(
      { items: [], total: 0, page, perPage, hasNextPage: false, error: "The provider is unavailable right now." },
      { status: 502 }
    );
  }
}
