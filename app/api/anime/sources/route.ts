import { NextResponse } from "next/server";
import { getProvider, ProviderError } from "@/lib/anime/providers";

export const dynamic = "force-dynamic";
// Allow enough time for upstream provider cold-starts / first extractions (Vercel max).
export const maxDuration = 60;

/**
 * Extracts direct .m3u8/.mp4 sources for a specific server.
 * Embed-only responses are rejected here so they can never reach the player.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const episodeId = searchParams.get("episodeId") ?? "";
  const serverId = searchParams.get("serverId") ?? undefined;
  const animeId = searchParams.get("animeId") ?? undefined;

  if (!episodeId) {
    return NextResponse.json({ sources: [], error: "Missing episodeId." }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const sources = await provider.getStreamingSources(episodeId, serverId, animeId);
    // Validate the underlying media URL (proxied play URLs are app-relative).
    const direct = sources.filter((s) => {
      const check = s.originalUrl ?? s.url;
      return /^https?:\/\//i.test(check) && /\.(m3u8|mp4)(\?|$)/i.test(check);
    });
    if (!direct.length) {
      return NextResponse.json(
        { sources: [], error: "This server only provides an embed page (unsupported)." },
        { status: 422 }
      );
    }
    return NextResponse.json({ sources: direct });
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 502;
    const message =
      err instanceof ProviderError ? err.message : "This server failed to extract sources.";
    console.error("[kuro] sources failed:", err);
    return NextResponse.json({ sources: [], error: message }, { status });
  }
}
