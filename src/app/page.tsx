"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, Film, Tv, Flame,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { MovieCard } from "@/components/cinepro/movie-card";

// ============================================================
// Types - Pure VPS API (No TMDB)
// ============================================================
interface MediaItem {
  id: string;          // cinemacity_id
  cinemacityId: string;
  slug: string;
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  overview: string;
  year: string;
  rating: number;
  quality?: string;
}

export default function HomePage() {
  const { setPlayerMedia, setDetailMedia } = useAppStore();

  const [data, setData] = useState<{
    hero: MediaItem[];
    movies: MediaItem[];
    popularMovies: MediaItem[];
    tvShows: MediaItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Load Home Data from VPS API
  // ============================================================
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/home");
        if (!r.ok) throw new Error("Failed to load");
        const data = await r.json();
        setData(data);
      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ============================================================
  // Handlers - Use cinemacityId (no imdbId needed)
  // ============================================================
  const handlePlay = useCallback((item: MediaItem) => {
    setPlayerMedia({
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
  }, [setPlayerMedia]);

  const handleDetail = useCallback((item: MediaItem) => {
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
  }, [setDetailMedia]);

  // ============================================================
  // Loading State
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
              <div className="absolute inset-0 rounded-full border-2 border-t-red-600 animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-white/60">Memuat film terbaru...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ============================================================
  // Error State
  // ============================================================
  if (error || !data) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-red-600/20 p-4">
            <Flame className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-white">Gagal memuat konten</p>
          <p className="max-w-md text-sm text-white/50">{error}</p>
        </div>
        <Footer />
      </div>
    );
  }

  // ============================================================
  // Main Render
  // ============================================================
  return (
    <div className="min-h-screen bg-black">
      <Header />

      {data.hero.length > 0 && (
        <HeroCarousel items={data.hero} onPlay={handlePlay} onMoreInfo={handleDetail} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Section
          title="Film Terbaru"
          icon={<Film className="h-5 w-5 text-red-500" />}
          items={data.movies}
          onItemClick={handleDetail}
        />
        <Section
          title="Film Populer"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          items={data.popularMovies}
          onItemClick={handleDetail}
        />
        <Section
          title="Series Terbaru"
          icon={<Tv className="h-5 w-5 text-purple-500" />}
          items={data.tvShows}
          onItemClick={handleDetail}
        />
      </div>

      <Footer />
    </div>
  );
}

// ============================================================
// Section Component (Horizontal Scroll)
// ============================================================
function Section({ title, icon, items, onItemClick }: {
  title: string;
  icon?: React.ReactNode;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          {icon}{title}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => (
          <MovieCard key={`${item.id}-${idx}`} item={item} onClick={onItemClick} />
        ))}
      </div>
    </section>
  );
}
