import { NextResponse } from "next/server";
import { getProvider } from "@/lib/anime/providers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const episodeId = searchParams.get("episodeId") ?? "";
  const animeId = searchParams.get("animeId") ?? undefined;

  if (!episodeId) {
    return NextResponse.json({ servers: [], error: "Missing episodeId." }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const servers = await provider.getEpisodeServers(episodeId, animeId);
    // Normalize ids and drop anything that is only an iframe embed.
    return NextResponse.json({
      servers: servers.filter((s) => !s.embedOnly),
    });
  } catch (err) {
    console.error("[kuro] servers failed:", err);
    return NextResponse.json({ servers: [], error: "Could not load servers." }, { status: 502 });
  }
}
