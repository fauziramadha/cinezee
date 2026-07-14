"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { ContentRow } from "@/components/cinepro/content-row";
import { Top10Row } from "@/components/cinepro/top10-row";
import { WatchHistory } from "@/components/cinepro/watch-history";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { useAppStore } from "@/lib/store";
import { fetchCinemacityHome, fetchCinemacityGenre } from "@/lib/cinemacity-api";
import type { Movie } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [asianMovies, setAsianMovies] = useState<Movie[]>([]);
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
        // Fetch home + Asian genre in parallel
        const [all, asian] = await Promise.all([
          fetchCinemacityHome("all"),
          fetchCinemacityGenre("asian", 1).catch(() => [] as Movie[]),
        ]);

        if (cancelled) return;
        setAllMovies(all);
        setAsianMovies(asian);
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

  // Pisahkan jadi movies & TV untuk section unik
  const moviesOnly = allMovies.filter((m) => m.media_type === "movie");
  const tvOnly = allMovies.filter((m) => m.media_type === "tv");

  // Hero = first 5 movies dengan poster
  const heroMovies = allMovies.filter((m) => m.poster_path).slice(0, 5);

  // TOP 10 = 10 first movies
  const top10 = allMovies.slice(0, 10);

  // Latest Movies (cuma movies, max 20)
  const latestMovies = moviesOnly.slice(0, 20);
  // TV Series (cuma TV, max 20)
  const latestTV = tvOnly.slice(0, 20);
  // Asian (max 20)
  const asian = asianMovies.slice(0, 20);

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

        {/* TOP 10 — dengan angka elegan */}
        {!loading && top10.length > 0 && (
          <Top10Row title="Top 10 Movies & TV" movies={top10} />
        )}

        {/* Latest Movies (max 20) */}
        {!loading && latestMovies.length > 0 && (
          <ContentRow title="🎬 Latest Movies" movies={latestMovies} />
        )}

        {/* TV Series (max 20) */}
        {!loading && latestTV.length > 0 && (
          <ContentRow title="📺 TV Series" movies={latestTV} />
        )}

        {/* Asian (max 20) */}
        {!loading && asian.length > 0 && (
          <ContentRow title="🌏 Asian" movies={asian} />
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
