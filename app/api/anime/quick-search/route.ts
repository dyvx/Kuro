import { NextResponse } from "next/server";
import { getProvider } from "@/lib/anime/providers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ items: [] });

  try {
    const provider = getProvider();
    const result = await provider.searchAnime(q, 1, 8);
    return NextResponse.json({
      items: result.items.map((a) => ({
        id: a.id,
        title: a.title,
        englishTitle: a.englishTitle,
        japaneseTitle: a.japaneseTitle,
        image: a.image,
        year: a.year ?? null,
        type: a.type,
        rating: a.rating ?? null,
      })),
    });
  } catch (err) {
    console.error("[kuro] quick-search failed:", err);
    return NextResponse.json({ items: [], error: "Search is temporarily unavailable." }, { status: 502 });
  }
}
