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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] progress DELETE failed:", err);
    return NextResponse.json({ error: "Could not remove progress." }, { status: 500 });
  }
}
