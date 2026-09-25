import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const ACCENTS = ["violet", "crimson", "azure", "emerald", "amber", "rose"];
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MAX_AVATAR_BYTES = 160_000; // ~160KB data-URL (client resizes to ≤256px)

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const store = getStore();
  const [profile, user] = await Promise.all([
    store.getProfile(userId),
    store.getUserById(userId).catch(() => null),
  ]);
  return NextResponse.json({
    profile: profile ?? null,
    fallbackName: user?.name ?? "Viewer",
    fallbackEmail: user?.email ?? "",
    accents: ACCENTS,
  });
}

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const patch: Record<string, unknown> = {};

  // Display name: 2–40 chars.
  if (body.displayName !== undefined) {
    const name = String(body.displayName).trim();
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json({ error: "Display name must be 2–40 characters." }, { status: 400 });
    }
    patch.displayName = name;
  }

  // Username: 3–20 chars [a-z0-9_], unique.
  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–20 characters: lowercase letters, numbers, underscore." },
        { status: 400 },
      );
    }
    if (await getStore().isUsernameTaken(username, userId)) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    patch.username = username;
  }

  // Bio: ≤200 chars.
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim();
    if (bio.length > 200) {
      return NextResponse.json({ error: "Bio must be 200 characters or fewer." }, { status: 400 });
    }
    patch.bio = bio;
  }

  // Avatar: data-URL image, type-checked + size-capped (already resized client-side).
  if (body.avatar !== undefined) {
    if (body.avatar === null || body.avatar === "") {
      patch.avatar = null;
    } else {
      const avatar = String(body.avatar);
      const m = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(avatar);
      if (!m) {
        return NextResponse.json({ error: "Avatar must be a PNG/JPEG/WebP image." }, { status: 400 });
      }
      if (avatar.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Avatar is too large after processing — try a smaller image." }, { status: 413 });
      }
      patch.avatar = avatar;
    }
  }

  // Accent: whitelisted palette.
  if (body.accent !== undefined) {
    const accent = String(body.accent);
    if (!ACCENTS.includes(accent)) {
      return NextResponse.json({ error: "Unknown accent." }, { status: 400 });
    }
    patch.accent = accent;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const profile = await getStore().updateProfile(userId, patch);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[kuro] profile update failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not update the profile." }, { status: 500 });
  }
}
