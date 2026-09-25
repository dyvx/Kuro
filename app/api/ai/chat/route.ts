import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/auth";
import { getAISettings, isConfigured, toPublic } from "@/lib/ai/settings";
import { runAIConversation, AIProviderError } from "@/lib/ai/run";
import { rateLimit } from "@/lib/ai/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 24;

function unauthorizedShape() {
  return NextResponse.json({ code: "not_signed_in" }, { status: 401 });
}

/** GET — capability probe for the AI page (no secrets in response). */
export async function GET() {
  const settings = await getAISettings();
  const userId = await getSessionUserId();
  return NextResponse.json({
    enabled: settings.enabled,
    configured: isConfigured(settings),
    providerName: settings.providerName,
    signedIn: Boolean(userId),
  });
}

export async function POST(req: Request) {
  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {
    return unauthorizedShape();
  }

  // Rate limit: authenticated users get more headroom than guests.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(userId ?? `ip:${ip}`, userId ? 30 : 10, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { code: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }

  const { messages } = (body ?? {}) as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }
  const turns = messages
    .filter((m): m is { role: "user" | "assistant"; content: string } => {
      const r = m as { role?: unknown; content?: unknown };
      return (
        (r.role === "user" || r.role === "assistant") && typeof r.content === "string"
      );
    })
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ code: "bad_request" }, { status: 400 });
  }

  const settings = await getAISettings();
  if (!settings.enabled || !isConfigured(settings)) {
    return NextResponse.json({ code: "not_configured", settings: toPublic(settings) }, { status: 503 });
  }

  try {
    const response = await runAIConversation({
      settings,
      messages: turns,
      userId,
      userName: null,
    });
    return NextResponse.json({ message: response });
  } catch (err) {
    // Log diagnostics server-side without leaking secrets.
    if (err instanceof AIProviderError) {
      console.error("[kuro-ai] provider error:", err.message, err.details?.status ?? "");
    } else {
      console.error("[kuro-ai] unexpected error:", err instanceof Error ? err.message : err);
    }
    const msg = err instanceof Error && err.name === "TimeoutError" ? "The AI provider timed out." : null;
    return NextResponse.json(
      { code: "provider_error", error: msg ?? undefined },
      { status: 502 },
    );
  }
}
