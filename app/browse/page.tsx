import type { Metadata } from "next";
import { BrowseClient } from "@/components/search/browse-client";

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse the full KURO anime catalog with filters and sorting.",
};

export default function BrowsePage() {
  return <BrowseClient />;
}
