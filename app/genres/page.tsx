import type { Metadata } from "next";
import { getProvider } from "@/lib/anime/providers";
import { GenreCard } from "@/components/anime/genre-card";

export const metadata: Metadata = {
  title: "Genres",
  description: "Explore anime by genre — action, romance, fantasy, psychological and more.",
};

const ORDER = ["Action", "Romance", "Fantasy", "Psychological", "Isekai", "Shounen", "Seinen"];

export default async function GenresPage() {
  const provider = getProvider();
  let genres: { name: string; count: number }[] = [];
  try {
    genres = await provider.getGenres();
  } catch {
    genres = [];
  }

  // Curated tags first, then the rest by count.
  genres.sort((a, b) => {
    const ia = ORDER.indexOf(a.name);
    const ib = ORDER.indexOf(b.name);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return b.count - a.count;
  });

  return (
    <div className="container-kuro pt-24 md:pt-20">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-txt">Genres</h1>
        <p className="mt-1 text-sm text-txt-muted">Pick a mood — we&apos;ll bring the stories.</p>
      </header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map((g) => (
          <GenreCard key={g.name} name={g.name} count={g.count} />
        ))}
      </div>
    </div>
  );
}
