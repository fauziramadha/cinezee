"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { ContentRow } from "@/components/cinepro/content-row";
import { ComicCard } from "@/components/comic/comic-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Movie } from "@/lib/tmdb";

interface TrendingItem extends Movie {}

interface ComicItem {
  title: string;
  slug: string;
  thumbnail?: string | null;
  image?: string | null;
  type?: string;
  genre?: string;
  chapter?: string;
  views?: string;
  description?: string;
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.error) return null;
  return res;
}

function normalizeKomiku(list: any[]): ComicItem[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => ({
    title: item.title || "Untitled",
    slug: (item.slug || "").toString().replace(/\/+$/, "").trim(),
    thumbnail: item.thumbnail || item.image || null,
    image: item.thumbnail || item.image || null,
    type: item.type || "Manga",
    genre: item.genre || undefined,
    chapter: item.latestChapter || item.chapterNumber || item.chapter || undefined,
    views: item.views || undefined,
    description: item.description || undefined,
  }));
}

export function NewContent() {
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [movies, setMovies] = useState<TrendingItem[]>([]);
  const [tvShows, setTvShows] = useState<TrendingItem[]>([]);
  const [comics, setComics] = useState<ComicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch trending, movies, tv, dan comics secara paralel
        const [trendingRes, moviesRes, tvRes, comicsRes] = await Promise.all([
          fetch("/api/trending", { cache: "no-store" }).catch(() => null),
          fetch("/api/movies/popular?page=1", { cache: "no-store" }).catch(() => null),
          fetch("/api/tv/popular?page=1", { cache: "no-store" }).catch(() => null),
          fetch("/api/comic/terbaru?page=1", { cache: "no-store" }).catch(() => null),
        ]);

        // Parse trending
        if (trendingRes?.ok) {
          const json = await trendingRes.json();
          const inner = unwrap(json);
          const results = inner?.results || [];
          setTrending(results);
          // Filter movies dan tv dari trending
          setMovies(results.filter((m: TrendingItem) => m.media_type === "movie" || m.title));
          setTvShows(results.filter((m: TrendingItem) => m.media_type === "tv" || (!m.title && m.name)));
        }

        // Parse movies (fallback kalau trending kosong)
        if (moviesRes?.ok) {
          const json = await moviesRes.json();
          const inner = unwrap(json);
          const results = inner?.results || [];
          if (results.length > 0 && movies.length === 0) {
            setMovies(results.map((m: any) => ({ ...m, media_type: "movie" as const })));
          }
        }

        // Parse TV (fallback kalau trending kosong)
        if (tvRes?.ok) {
          const json = await tvRes.json();
          const inner = unwrap(json);
          const results = inner?.results || [];
          if (results.length > 0 && tvShows.length === 0) {
            setTvShows(results.map((m: any) => ({ ...m, media_type: "tv" as const })));
          }
        }

        // Parse comics
        if (comicsRes?.ok) {
          const json = await comicsRes.json();
          const inner = unwrap(json);
          const list = normalizeKomiku(inner?.items || []);
          setComics(list);
        }
      } catch (err) {
        console.error("[New page] error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Coba lagi
          </Button>
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  // Scroll helper untuk komik row
  const scrollComics = (direction: "left" | "right") => {
    const el = document.getElementById("comic-scroll");
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero Carousel (pakai trending) */}
      {trending.length > 0 && <HeroCarousel movies={trending} />}

      <div className="relative z-10 space-y-6 pb-16 pt-4 sm:space-y-8 sm:pt-6 md:-mt-16 md:space-y-10 md:pt-0 lg:-mt-24">
        <div className="px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Beranda
          </a>
        </div>

        {/* Trending Movies */}
        {movies.length > 0 && (
          <ContentRow title="🔥 Film Terbaru" movies={movies} />
        )}

        {/* Trending TV Shows */}
        {tvShows.length > 0 && (
          <ContentRow title="📺 TV Shows Terbaru" movies={tvShows} />
        )}

        {/* Komik Terbaru (horizontal scroll, pakai ComicCard) */}
        {comics.length > 0 && (
          <section className="group/row relative">
            <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
              <h2 className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
                📚 Komik Terbaru
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => scrollComics("left")}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => scrollComics("right")}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              id="comic-scroll"
              className="content-row flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8"
              style={{ scrollbarWidth: "none" }}
            >
              {comics.map((comic, idx) => (
                <div
                  key={comic.slug || idx}
                  className="w-28 shrink-0 sm:w-32 md:w-36 lg:w-40"
                >
                  <ComicCard comic={comic} />
                </div>
              ))}
              <div className="w-1 shrink-0" />
            </div>
          </section>
        )}

        {/* Empty state */}
        {trending.length === 0 && comics.length === 0 && (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Tidak ada konten terbaru saat ini.
            </p>
          </div>
        )}
      </div>

      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
