import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { hashPassword, isValidEmail } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const password = String(body?.password ?? "");

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const store = getStore();
    const existing = await store.getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    await store.createUser({
      id: `u_${crypto.randomUUID()}`,
      email,
      name,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kuro] register failed:", err);
    return NextResponse.json({ error: "Could not create the account. Please try again." }, { status: 500 });
  }
}
