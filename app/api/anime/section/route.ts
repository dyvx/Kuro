import { NextResponse } from "next/server";
import { loadSection } from "@/lib/anime/sections";
import type { SectionSlug } from "@/types/anime";

export const dynamic = "force-dynamic";

const VALID_SLUGS: SectionSlug["slug"][] = [
  "trending", "popular", "recent-updated", "recent-added", "most-watched",
  "action", "romance", "fantasy", "psychological", "isekai", "shounen", "seinen",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") as SectionSlug["slug"];
  const perPage = Math.min(30, Math.max(6, parseInt(searchParams.get("perPage") ?? "18", 10) || 18));

  if (!VALID_SLUGS.includes(slug)) {
    return NextResponse.json({ items: [], error: "Unknown section." }, { status: 400 });
  }

  try {
    const items = await loadSection(slug, perPage);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[kuro] section api failed:", err);
    return NextResponse.json({ items: [], error: "Provider unavailable." }, { status: 502 });
  }
}
