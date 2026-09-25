import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getMemory, clearMemory, sanitizeMemory } from "@/lib/ai/memory";

export const dynamic = "force-dynamic";

/** GET — the signed-in user inspects their own AI memory. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const memory = sanitizeMemory(await getMemory(userId));
  return NextResponse.json({
    memory,
    summary: {
      genres: memory.favoriteGenres.length,
      likes: memory.likedAnime.length,
      dislikes: memory.dislikedAnime.length,
      hasNotes: Boolean(memory.notes || memory.recommendationPreferences),
    },
  });
}

/** DELETE — clear my AI memory (privacy control). */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await clearMemory(userId);
  return NextResponse.json({ ok: true });
}
