"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { MovieCard, type MediaItem } from "@/components/cinepro/movie-card";
import { Loader2, Film, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

export default function GenrePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genreName, setGenreName] = useState("");
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const setDetailMedia = useAppStore((s) => s.setDetailMedia);

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
      const res = await fetch(`${VPS_API_BASE}/api/genre/${slug}?page=${pageNum}`);
      if (!res.ok) throw new Error("Failed to fetch genre");
      const data = await res.json();

      const items = data.data?.items || [];
      
      const adapted: MediaItem[] = items.map((item: any) => ({
        id: String(item.cinemacity_id),
        cinemacityId: String(item.cinemacity_id),
        slug: item.slug,
        title: item.title || "Untitled",
        type: item.type === "tv" ? "tv" : "movie",
        poster: item.poster_url ? `${VPS_API_BASE}/api/image?url=${encodeURIComponent(item.poster_url)}` : "/placeholder-poster.png",
        backdrop: item.poster_url ? `${VPS_API_BASE}/api/image?url=${encodeURIComponent(item.poster_url)}` : "/placeholder-poster.png",
        overview: item.description || "",
        year: item.release_year ? String(item.release_year) : "",
        rating: item.rating ? parseFloat(item.rating) : 0,
        quality: item.quality || undefined,
      }));
      
      setMovies(adapted);
      setHasMore(data.data?.has_more ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load. Coba lagi.");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCardClick = (item: MediaItem) => {
    setDetailMedia({
      id: item.cinemacityId || item.id,
      cinemacityId: item.cinemacityId,
      slug: item.slug,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
    } as any);
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

        {/* Loading State */}
        {loading && movies.length === 0 && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchGenre(page)}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Movies Grid */}
        {!loading && !error && movies.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
              {movies.map((item) => (
                <MovieCard
                  key={`${item.id}-${item.slug}`}
                  item={item}
                  onClick={handleCardClick}
                  className="w-full"
                />
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
      
      {/* Render modals agar MovieCard bisa diklik */}
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
