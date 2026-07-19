"use client";

import { useEffect, useState } from "react";
import { Play, Star, TrendingUp, Film, Tv } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { fetchTrending, fetchPopular, TMDBItem } from "@/lib/tmdb-api";

export default function HomePage() {
  const { setPlayerMedia } = useAppStore();

  const [trending, setTrending] = useState<TMDBItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBItem[]>([]);
  const [popularTV, setPopularTV] = useState<TMDBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tr, popMov, popTV] = await Promise.all([
          fetchTrending("week", "all"),
          fetchPopular("movie"),
          fetchPopular("tv"),
        ]);
        setTrending(tr);
        setPopularMovies(popMov);
        setPopularTV(popTV);
      } catch (err: any) {
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePlay = (item: TMDBItem) => {
    // Pastikan playerMedia punya imdbId
    setPlayerMedia({
      id: item.id,
      imdbId: item.id.startsWith("tt") ? item.id : undefined,
      tmdbId: item.tmdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      seasons: item.seasons,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-white/70">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6">
        <p className="text-red-400">Error: {error}</p>
        <p className="text-xs text-white/50">
          Pastikan TMDB_API_KEY sudah diset di Cloudflare Workers secrets
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* HERO (Trending pertama) */}
      {trending[0] && (
        <HeroSection item={trending[0]} onPlay={handlePlay} />
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Trending */}
        <Section
          title="Trending Minggu Ini"
          icon={<TrendingUp className="h-5 w-5" />}
          items={trending}
          onPlay={handlePlay}
        />

        {/* Popular Movies */}
        <Section
          title="Film Populer"
          icon={<Film className="h-5 w-5" />}
          items={popularMovies}
          onPlay={handlePlay}
        />

        {/* Popular TV */}
        <Section
          title="Series Populer"
          icon={<Tv className="h-5 w-5" />}
          items={popularTV}
          onPlay={handlePlay}
        />
      </div>
    </div>
  );
}

// ============================================================
// Hero Section (backdrop besar + tombol Play)
// ============================================================
function HeroSection({ item, onPlay }: { item: TMDBItem; onPlay: (i: TMDBItem) => void }) {
  return (
    <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden">
      <img
        src={item.backdrop}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14">
        <h1 className="max-w-2xl text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          {item.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            {item.rating.toFixed(1)}
          </span>
          <span>•</span>
          <span>{item.year}</span>
          <span>•</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs uppercase">
            {item.type}
          </span>
        </div>
        <p className="mt-3 max-w-xl text-sm text-white/70 line-clamp-3 sm:text-base">
          {item.overview}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onPlay(item)}
            className="flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Play className="h-4 w-4 fill-black" />
            Play
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section (horizontal scrollable poster grid)
// ============================================================
function Section({
  title,
  icon,
  items,
  onPlay,
}: {
  title: string;
  icon?: React.ReactNode;
  items: TMDBItem[];
  onPlay: (i: TMDBItem) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white sm:text-xl">
        {icon}
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={`${item.id}-${item.type}`}
            onClick={() => onPlay(item)}
            className="group relative w-32 shrink-0 sm:w-40 md:w-44"
          >
            <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-900">
              <img
                src={item.poster}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
              <Play className="h-8 w-8 fill-white text-white" />
            </div>
            <div className="mt-2">
              <p className="line-clamp-1 text-xs font-medium text-white sm:text-sm">
                {item.title}
              </p>
              <p className="text-[10px] text-white/50">{item.year}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
