import type { Metadata } from "next";
import { ContinueClient } from "@/components/library/continue-client";

export const metadata: Metadata = {
  title: "Continue Watching",
  description: "Pick up right where you left off.",
};

export default function ContinueWatchingPage() {
  return <ContinueClient />;
}
