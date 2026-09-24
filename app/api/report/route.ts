import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

/** Broken-source reports (used to prioritize provider fixes). */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  const body = (await req.json().catch(() => null)) as {
    animeId?: string;
    episodeId?: string;
    serverId?: string;
    reason?: string;
  } | null;

  if (!body?.animeId || !body?.episodeId || !body?.serverId) {
    return NextResponse.json({ error: "animeId, episodeId and serverId are required." }, { status: 400 });
  }

  const store = getStore();
  try {
    await store.addReport({
      id: `r_${crypto.randomUUID()}`,
      userId: userId ?? null,
      animeId: String(body.animeId),
      episodeId: String(body.episodeId),
      serverId: String(body.serverId),
      reason: body.reason ? String(body.reason).slice(0, 500) : undefined,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] report failed:", err);
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }
}
