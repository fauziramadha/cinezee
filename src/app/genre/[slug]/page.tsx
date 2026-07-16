"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { MovieCard } from "@/components/cinepro/movie-card";
import { Loader2, Film, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true); // Cinemacity gak kasih info total page, jadi kita estimasi

  // Capitalize genre name for display
  useEffect(() => {
    const name = slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    setGenreName(name);
    document.title = `${name} Movies & TV — CineStream`;
  }, [slug]);

  const fetchGenre = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cinemacity/genre/${slug}?page=${pageNum}`);
      if (!res.ok) throw new Error("Failed to fetch genre");
      const data = await res.json();

      const cinemacityMovies: CinemacityMovie[] = data.movies || [];
      const adapted: Movie[] = cinemacityMovies.map(cinemacityToTMDB);
      
      setMovies(adapted);
      
      // Cinemacity biasanya menampilkan 20-24 film per halaman
      // Kalau hasil < 20, berarti ini halaman terakhir
      if (adapted.length < 20) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchGenre(1);
  }, [fetchGenre]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setPage(newPage);
    fetchGenre(newPage);
    // Scroll ke atas halaman
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
              {loading ? "Loading..." : `Page ${page}`}
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
              onClick={() => fetchGenre(page)}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Movies Grid */}
        {!loading && !error && movies.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {movies.map((movie) => (
                <MovieCard key={`${movie.id}-${movie.media_type}`} movie={movie} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>

              <span className="text-sm font-medium text-muted-foreground">
                Page {page}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasMore || loading}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
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
