import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getStore } from "@/lib/db/store";
import { verifyPassword } from "./password";

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  console.warn(
    "[kuro] NEXTAUTH_SECRET is not set — falling back to an insecure dev secret. Set it in your hosting environment!"
  );
}

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET ?? "kuro-insecure-dev-secret",
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const store = getStore();
        // Convenience demo account (only meaningful with the memory store).
        if (
          credentials.email.toLowerCase() === "demo@kuro.app" &&
          credentials.password === "kurodemo" &&
          store.kind === "memory"
        ) {
          const { ensureDemoUser } = await import("@/lib/db/store");
          const demo = await ensureDemoUser();
          return { id: demo.id, name: demo.name, email: demo.email };
        }
        const user = await store.getUserByEmail(credentials.email);
        if (!user) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = String(user.id);
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid);
      }
      return session;
    },
  },
};

/** Extract the current user id from a server-side session (or null). */
export async function getSessionUserId(): Promise<string | null> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
