import type { Metadata } from "next";
import { HistoryClient } from "@/components/library/history-client";

export const metadata: Metadata = {
  title: "History",
  description: "Everything you've watched on KURO.",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
