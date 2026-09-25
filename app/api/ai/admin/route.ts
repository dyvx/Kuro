import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getAISettings, isConfigured, saveAISettings, toPublic, isAdminEmail } from "@/lib/ai/settings";
import { createAIProvider } from "@/lib/ai/provider";
import { hasMongo } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

async function guard() {
  const userId = await getSessionUserId();
  if (!userId) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  // Resolve the email for the admin allowlist.
  const store = await import("@/lib/db/store");
  const user = await store.getStore().getUserById(userId).catch(() => null);
  const email = user?.email ?? (userId.includes("@") ? userId : null);
  if (!isAdminEmail(email)) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { userId };
}

/** GET — current AI settings (masked; never the API key). */
export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const settings = await getAISettings();
  return NextResponse.json({
    settings: { ...toPublic(settings), systemPromptOverride: settings.systemPromptOverride ?? "" },
    adminConfigured: Boolean((process.env.AI_ADMIN_EMAILS ?? "").trim()),
    dbBacked: hasMongo(),
  });
}

/** PUT — update settings (API key optional: empty = keep existing). */
export async function PUT(req: Request) {
  const g = await guard();
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  try {
    await saveAISettings(body);
    const settings = await getAISettings();
    return NextResponse.json({ settings: toPublic(settings) });
  } catch (err) {
    console.error("[kuro-ai] settings save failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}

/** POST action=test — ping the configured provider with a 1-token request. */
export async function POST() {
  const g = await guard();
  if (g.error) return g.error;
  const settings = await getAISettings();
  if (!isConfigured(settings)) {
    return NextResponse.json({ ok: false, message: "Not configured — base URL, API key and model are required." });
  }
  try {
    const provider = createAIProvider(settings);
    const res = await provider.chat({
      messages: [{ role: "user", content: "ping" }],
      tools: [],
      temperature: 0,
      maxTokens: 16,
      timeoutMs: Math.min(settings.timeoutMs, 20_000),
    });
    return NextResponse.json({
      ok: true,
      message: `${settings.providerName} responded${res.text ? `: “${res.text.slice(0, 60)}”` : " (empty reply, but reachable)."}`,
    });
  } catch (err) {
    const status = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "failed";
    const httpStatus = typeof (err as { details?: { status?: number } })?.details?.status;
    return NextResponse.json({
      ok: false,
      message: `Provider ${status}${Number.isFinite(httpStatus) ? ` (HTTP ${httpStatus})` : ""}. Check base URL / key / model.`,
    });
  }
}
