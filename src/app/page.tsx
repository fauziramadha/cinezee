"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, Film, Tv, Flame, Trophy, Globe, Sparkles,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { MovieCard } from "@/components/cinepro/movie-card";
import { Top10Row } from "@/components/cinepro/top10-row";

// ============================================================
// Types - Pure VPS API (No TMDB)
// ============================================================
interface MediaItem {
  id: string;
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
    top10: MediaItem[];
    trending: MediaItem[];
    asian: MediaItem[];
    indian: MediaItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <p className="text-sm font-medium text-white/60">Memuat konten...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {data.hero.length > 0 && (
        <HeroCarousel items={data.hero} onPlay={handlePlay} onMoreInfo={handleDetail} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* TOP 10 - Netflix style ranking */}
        {data.top10.length > 0 && (
          <div className="mb-8">
            <Top10Row
              title="Top 10"
              items={data.top10}
              onItemClick={handleDetail}
            />
          </div>
        )}

        {/* Trending */}
        <Section
          title="Trending"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          items={data.trending}
          onItemClick={handleDetail}
        />

        {/* Asian */}
        <Section
          title="Asian"
          icon={<Globe className="h-5 w-5 text-blue-500" />}
          items={data.asian}
          onItemClick={handleDetail}
        />

        {/* Indian */}
        <Section
          title="Indian"
          icon={<Sparkles className="h-5 w-5 text-yellow-500" />}
          items={data.indian}
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
