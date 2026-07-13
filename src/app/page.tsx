"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { ContentRow } from "@/components/cinepro/content-row";
import { WatchHistory } from "@/components/cinepro/watch-history";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { useAppStore } from "@/lib/store";
import { fetchCinemacityHome } from "@/lib/cinemacity-api";
import type { Movie } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tvShows, setTvShows] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useAppStore((s) => s.loadHistory);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        // Fetch all content from cinemacity
        const [all, moviesOnly, tvOnly] = await Promise.all([
          fetchCinemacityHome("all"),
          fetchCinemacityHome("movies"),
          fetchCinemacityHome("tv"),
        ]);

        if (cancelled) return;
        setAllMovies(all);
        setMovies(moviesOnly);
        setTvShows(tvOnly);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load content");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Hero = first 5 movies with posters
  const heroMovies = allMovies.filter((m) => m.poster_path).slice(0, 5);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      {loading ? (
        <div className="flex h-[70vh] min-h-[480px] items-center justify-center bg-muted/20 md:h-[85vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading cinemacity content...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-[70vh] min-h-[480px] flex-col items-center justify-center gap-3 px-4 text-center md:h-[85vh]">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <HeroCarousel movies={heroMovies} />
      )}

      {/* Content rows */}
      <div className="relative z-10 -mt-32 space-y-8 pb-16 md:-mt-40">
        {/* Continue Watching */}
        <WatchHistory />

        {/* All Movies & TV (cinemacity) */}
        {!loading && allMovies.length > 0 && (
          <ContentRow title="🎬 Latest Movies & TV" movies={allMovies.slice(0, 20)} />
        )}

        {/* Movies only */}
        {!loading && movies.length > 0 && (
          <ContentRow title="🎥 Movies" movies={movies} />
        )}

        {/* TV Shows */}
        {!loading && tvShows.length > 0 && (
          <ContentRow title="📺 TV Series" movies={tvShows} />
        )}

        {/* All content */}
        {!loading && allMovies.length > 20 && (
          <ContentRow title="🌟 All Content" movies={allMovies} />
        )}
      </div>

      <Footer />

      {/* Modals */}
      <SearchModal />
      <DetailModal />
      <PlayerModal />
    </main>
  );
}
