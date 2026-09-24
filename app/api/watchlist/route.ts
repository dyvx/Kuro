import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Sign in to use your watchlist." }, { status: 401 });
}

interface LibraryBody {
  animeId?: string;
  animeTitle?: string;
  animeImage?: string | null;
  animeType?: string;
  animeYear?: number | null;
  animeRating?: number | null;
}

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get("animeId");
  const store = getStore();
  try {
    if (animeId) {
      const inList = await store.inWatchlist(userId, animeId);
      return NextResponse.json({ inWatchlist: inList });
    }
    const items = await store.listWatchlist(userId);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[kuro] watchlist GET failed:", err);
    return NextResponse.json({ error: "Could not load your watchlist." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as LibraryBody | null;
  if (!body?.animeId || !body?.animeTitle) {
    return NextResponse.json({ error: "animeId and animeTitle are required." }, { status: 400 });
  }
  const store = getStore();
  try {
    await store.addWatchlist(userId, {
      animeId: String(body.animeId),
      animeTitle: String(body.animeTitle),
      animeImage: body.animeImage ?? null,
      animeType: body.animeType,
      animeYear: body.animeYear ?? null,
      animeRating: body.animeRating ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] watchlist POST failed:", err);
    return NextResponse.json({ error: "Could not update your watchlist." }, { status: 500 });
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
    await store.removeWatchlist(userId, animeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] watchlist DELETE failed:", err);
    return NextResponse.json({ error: "Could not update your watchlist." }, { status: 500 });
  }
}
