import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore } from "@/lib/db/store";
import { getWatchingStats } from "@/lib/stats";
import { evaluateAchievements } from "@/lib/achievements";

export const dynamic = "force-dynamic";

/** One call powers the whole profile: real stats + achievement state. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const store = getStore();
  try {
    const [stats, achievements] = await Promise.all([
      getWatchingStats(userId, store),
      evaluateAchievements(userId, store),
    ]);
    return NextResponse.json({
      stats,
      achievements: achievements.view,
      newlyUnlocked: achievements.newlyUnlocked.map((a) => a.id),
    });
  } catch (err) {
    console.error("[kuro] stats failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load stats." }, { status: 500 });
  }
}
