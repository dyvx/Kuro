import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore, type ProgressInput } from "@/lib/db/store";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Sign in to save progress." }, { status: 401 });
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId");
  const store = getStore();
  try {
    if (animeId) {
      const progress = await store.getProgress(userId, animeId);
      return NextResponse.json({ progress });
    }
    const completed = searchParams.get("completed");
    const items = await store.listProgress(userId, {
      completed: completed === "true" ? true : completed === "false" ? false : undefined,
    });
    return NextResponse.json({ progress: items });
  } catch (err) {
    console.error("[kuro] progress GET failed:", err);
    return NextResponse.json({ error: "Could not load progress." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as Partial<ProgressInput> | null;
  if (!body?.animeId || !body?.episodeId) {
    return NextResponse.json({ error: "animeId and episodeId are required." }, { status: 400 });
  }
  const store = getStore();
  try {
    const prev = await store.getProgress(userId, String(body.animeId));
    const saved = await store.upsertProgress(userId, {
      animeId: String(body.animeId),
      animeTitle: String(body.animeTitle ?? "Unknown"),
      animeImage: body.animeImage ?? null,
      episodeId: String(body.episodeId),
      episodeNumber: num(body.episodeNumber, 1),
      episodeTitle: body.episodeTitle ?? null,
      position: Math.max(0, num(body.position)),
      duration: Math.max(0, num(body.duration)),
    });

    // Activity ledger (one compact doc/user/day) + achievement evaluation.
    // Fire-and-forget: playback must never wait on gamification.
    const advancedEpisode = prev ? saved.episodeNumber > prev.episodeNumber : true;
    void store
      .recordActivity(userId, { hour: new Date().getHours(), newEpisode: advancedEpisode })
      .then(() => import("@/lib/stats").then((s) => s.invalidateStatsCache(userId)))
      .then(() => {
        const g = globalThis as unknown as { __kuroAchEval?: Map<string, number> };
        g.__kuroAchEval ??= new Map();
        const last = g.__kuroAchEval.get(userId) ?? 0;
        if (Date.now() - last < 20_000) return; // throttle re-evaluation
        g.__kuroAchEval.set(userId, Date.now());
        return import("@/lib/achievements").then((m) => m.evaluateAchievements(userId, store));
      })
      .catch(() => {});

    return NextResponse.json({ progress: saved });
  } catch (err) {
    console.error("[kuro] progress POST failed:", err);
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId");
  if (!animeId) return NextResponse.json({ error: "animeId is required." }, { status: 400 });
  const store = getStore();
  try {
    await store.deleteProgress(userId, animeId);
    const { invalidateStatsCache } = await import("@/lib/stats");
    invalidateStatsCache(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] progress DELETE failed:", err);
    return NextResponse.json({ error: "Could not remove progress." }, { status: 500 });
  }
}
