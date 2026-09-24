import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a KURO account to build watchlists and sync progress.",
};

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
