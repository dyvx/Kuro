import { NextResponse } from "next/server";
import { getProviderDisplay } from "@/lib/anime/providers";
import { hasMongo } from "@/lib/db/mongo";

export const dynamic = "force-dynamic";

/** Quick self-check: provider wiring + MongoDB connectivity. */
export async function GET() {
  const provider = getProviderDisplay();

  let mongo: { configured: boolean; connected: boolean; error?: string } = {
    configured: false,
    connected: false,
  };

  if (hasMongo()) {
    mongo.configured = true;
    try {
      const { getDb } = await import("@/lib/db/mongo");
      const db = await getDb();
      await db.command({ ping: 1 });
      mongo.connected = true;
    } catch (err) {
      mongo.error = err instanceof Error ? err.message.slice(0, 140) : "connection failed";
    }
  }

  return NextResponse.json({
    ok: true,
    provider: { id: provider.id, name: provider.name, demo: provider.demo },
    mongo,
    time: new Date().toISOString(),
  });
}
