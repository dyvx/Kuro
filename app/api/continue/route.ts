import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore } from "@/lib/db/store";
import { getProvider } from "@/lib/anime/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NEXT_EPISODE_THRESHOLD = 0.9;

export interface ContinueItem {
  animeId: string;
  animeTitle: string;
  animeImage: string | null;
  episodeNumber: number;
  /** Episode id the Continue button should open (next ep when this one is ~done). */
  resumeEpisodeId: string;
  resumeEpisodeNumber: number;
  /** true → we're pointing at the NEXT episode because this one was finished. */
  movingToNext: boolean;
  percent: number;
  updatedAt: string;
}

/**
 * Smart Continue Watching: returns in-progress titles with an exact
 * resume target. If the saved episode is essentially finished (≥90%
 * or flagged completed), the item points at the next episode instead
 * (resolved through the provider's cached episode list — never guessed).
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const store = getStore();
  const provider = getProvider();

  try {
    // All entries — completed ones still matter: they become "move to the
    // next episode" cards unless the anime itself is finished.
    const all = await store.listProgress(userId);
    all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const items: ContinueItem[] = [];
    // Group by anime: keep the most recent entry per anime.
    const seenAnime = new Set<string>();
    for (const p of all) {
      if (seenAnime.has(p.animeId)) continue;
      seenAnime.add(p.animeId);

      const ratio = p.duration > 0 ? p.position / p.duration : 0;
      const finishedEpisode = p.completed || ratio >= NEXT_EPISODE_THRESHOLD;
      let resumeEpisodeId = p.episodeId;
      let resumeEpisodeNumber = p.episodeNumber;
      let movingToNext = false;

      if (finishedEpisode) {
        try {
          const nextId = await provider.findEpisodeId(p.animeId, p.episodeNumber + 1);
          if (nextId) {
            resumeEpisodeId = nextId;
            resumeEpisodeNumber = p.episodeNumber + 1;
            movingToNext = true;
          }
          // No next episode → the anime is finished; leave it in history,
          // drop it from active continue (spec §2).
          else if (p.completed || ratio >= 0.98) continue;
        } catch {
          /* provider hiccup → keep pointing at the saved episode */
        }
      }

      items.push({
        animeId: p.animeId,
        animeTitle: p.animeTitle,
        animeImage: p.animeImage,
        episodeNumber: p.episodeNumber,
        resumeEpisodeId,
        resumeEpisodeNumber,
        movingToNext,
        percent: Math.min(100, Math.round(ratio * 100)),
        updatedAt: p.updatedAt,
      });
      if (items.length >= 20) break;
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[kuro] continue failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ items: [], error: "Could not load continue-watching." }, { status: 500 });
  }
}

/** DELETE ?animeId= — remove a title from active continue-watching. */
export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const animeId = new URL(req.url).searchParams.get("animeId");
  if (!animeId) return NextResponse.json({ error: "animeId required." }, { status: 400 });
  await getStore().deleteProgress(userId, animeId);
  return NextResponse.json({ ok: true });
}
