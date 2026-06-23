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
import { AuthModal } from "@/components/cinepro/auth-modal";
import { AdminDashboard } from "@/components/cinepro/admin-dashboard";
import { useAppStore } from "@/lib/store";
import { trackPageView } from "@/lib/analytics";
import type { Movie } from "@/lib/tmdb";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTV, setPopularTV] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  const loadHistory = useAppStore((s) => s.loadHistory);
  useEffect(() => {
    loadHistory();
    // Track page view
    trackPageView("/");
  }, [loadHistory]);

  // Fetch all data in parallel
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const [trend, popMovies, popTV] = await Promise.all([
          fetch("/api/trending").then((r) => r.json()),
          fetch("/api/movies/popular").then((r) => r.json()),
          fetch("/api/tv/popular").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setTrending(trend.results || []);
        setPopularMovies(popMovies.results || []);
        setPopularTV(popTV.results || []);
        const all = [
          ...(popMovies.results || []),
          ...(popTV.results || []),
        ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        setTopRated(all.slice(0, 12));
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

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero - lebih compact di mobile (60vh), tinggi normal di desktop */}
      {loading ? (
        <div className="flex h-[60vh] min-h-[400px] items-center justify-center bg-muted/20 md:h-[75vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading trending content...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-[60vh] min-h-[400px] flex-col items-center justify-center gap-3 px-4 text-center md:h-[75vh]">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <HeroCarousel movies={trending} />
      )}

      {/* Content rows - SMALL gap on mobile (no overlap), larger on desktop */}
      <div className="relative z-10 space-y-6 pb-16 pt-4 sm:space-y-8 sm:pt-6 md:-mt-16 md:space-y-10 md:pt-0 lg:-mt-24">
        <WatchHistory />

        {!loading && trending.length > 0 && (
          <ContentRow title="🔥 Trending Now" movies={trending.slice(0, 12)} />
        )}

        {!loading && popularMovies.length > 0 && (
          <ContentRow title="🎬 Popular Movies" movies={popularMovies} />
        )}

        {!loading && topRated.length > 0 && (
          <ContentRow title="⭐ Top Rated" movies={topRated} />
        )}

        {!loading && popularTV.length > 0 && (
          <ContentRow title="📺 Popular TV Shows" movies={popularTV} />
        )}

        {!loading && trending.length > 0 && (
          <ContentRow title="🌟 All Trending" movies={trending} />
        )}
      </div>

      <Footer />

      {/* Modals */}
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
      <AdminDashboard />
    </main>
  );
}
