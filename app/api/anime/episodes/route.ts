import { NextResponse } from "next/server";
import { getProvider } from "@/lib/anime/providers";
import type { EpisodeBundle } from "@/types/anime";

export const dynamic = "force-dynamic";
// Provider episode discovery can scrape upstream on first request (cold).
export const maxDuration = 60;

/**
 * Episode bundle for a title. Loaded client-side so pages render
 * instantly while slower provider scrapes stream in with skeletons.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const provider = getProvider();
  try {
    const bundle: EpisodeBundle = await provider.getEpisodes(id);
    return NextResponse.json(bundle, {
      headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=1800" },
    });
  } catch (err) {
    console.error("[kuro] episodes api failed:", err);
    return NextResponse.json(
      { seasons: [], episodes: [], error: "Could not load episodes right now." },
      { status: 502 }
    );
  }
}
