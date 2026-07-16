"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { MovieCard } from "@/components/cinepro/movie-card";
import { Loader2, Film } from "lucide-react";
import type { Movie } from "@/lib/tmdb";
import { cinemacityToTMDB } from "@/lib/cinemacity-api";

interface CinemacityMovie {
  id: string;
  slug: string;
  type: "movie" | "tv";
  title: string;
  url: string;
  poster?: string;
  year?: string;
}

export default function GenrePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genreName, setGenreName] = useState("");

  // Capitalize genre name for display
  useEffect(() => {
    const name = slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    setGenreName(name);
    document.title = `${name} Movies & TV — CineStream`;
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    const fetchGenre = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cinemacity/genre/${slug}`);
        if (!res.ok) throw new Error("Failed to fetch genre");
        const data = await res.json();
        if (cancelled) return;

        const cinemacityMovies: CinemacityMovie[] = data.movies || [];
        const adapted: Movie[] = cinemacityMovies.map(cinemacityToTMDB);
        setMovies(adapted);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGenre();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Film className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {genreName}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {loading ? "Loading..." : `${movies.length} titles found`}
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Movies Grid */}
        {!loading && !error && movies.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {movies.map((movie) => (
              <MovieCard key={`${movie.id}-${movie.media_type}`} movie={movie} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && movies.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <Film className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No titles found for this genre.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
