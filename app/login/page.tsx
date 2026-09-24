import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to KURO to sync your watchlist and continue watching.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
