import type { Metadata } from "next";
import { AIClient } from "@/components/ai/ai-client";

export const metadata: Metadata = {
  title: "KURO AI",
  description: "Your built-in anime assistant — search the catalog, get recommendations from your history, and continue watching, conversationally.",
};

export default function AIPage() {
  return <AIClient />;
}
