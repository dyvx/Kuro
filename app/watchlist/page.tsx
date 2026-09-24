import type { Metadata } from "next";
import { WatchlistClient } from "@/components/library/watchlist-client";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Your personal anime watchlist.",
};

export default function WatchlistPage() {
  return <WatchlistClient />;
}
