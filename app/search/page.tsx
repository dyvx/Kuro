import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "@/components/search/search-client";
import { SkeletonGrid } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the KURO catalog by title, genre, year, type, and rating.",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-kuro pt-24 md:pt-20">
          <SkeletonGrid count={12} />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
