"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, TrendingUp, Film, Tv, Sparkles,
  ChevronLeft, ChevronRight, Flame, Award,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  fetchTrending, fetchNowPlaying, fetchPopularMovies, fetchTopRatedMovies,
  fetchPopularTV, fetchTopRatedTV, fetchByGenre,
  fetchDetail, MediaItem,
} from "@/lib/tmdb";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";

const MOVIE_GENRES = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 16, name: "Animation" },
  { id: 12, name: "Adventure" },
];

export default function HomePage() {
  const { setPlayerMedia, setDetailMedia } = useAppStore();

  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [popularTV, setPopularTV] = useState<MediaItem[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<MediaItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MediaItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<MediaItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [tr, np, pm, tr2, ptv, trt, act, com] = await Promise.all([
          fetchTrending("week"),
          fetchNowPlaying(),
          fetchPopularMovies(),
          fetchTopRatedMovies(),
          fetchPopularTV(),
          fetchTopRatedTV(),
          fetchByGenre(28, "movie"),
          fetchByGenre(35, "movie"),
        ]);

        const heroCandidates = tr.filter(m => m.backdrop && !m.backdrop.includes("placeholder"));
        setTrending(heroCandidates.length > 0 ? heroCandidates : tr);
        setNowPlaying(np);
        setPopularMovies(pm);
        setTopRated(tr2);
        setPopularTV(ptv);
        setTopRatedTV(trt);
        setActionMovies(act);
        setComedyMovies(com);
      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // === Klik poster → buka detail modal ===
  const handlePosterClick = useCallback(async (item: MediaItem) => {
    // Set detail media (untuk DetailModal)
    setDetailMedia({
      id: item.id,
      tmdbId: item.tmdbId,
      imdbId: item.imdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      seasons: (item as any).seasons,
    });
  }, [setDetailMedia]);

  // === Klik tombol Play di Hero → langsung play ===
  const handlePlay = useCallback(async (item: MediaItem) => {
    let enrichedItem = item;
    if (!item.imdbId) {
      const detail = await fetchDetail(item.tmdbId, item.type);
      if (detail) enrichedItem = detail;
    }
    setPlayerMedia({
      id: enrichedItem.id,
      imdbId: enrichedItem.imdbId,
      tmdbId: enrichedItem.tmdbId,
      title: enrichedItem.title,
      type: enrichedItem.type,
      poster: enrichedItem.poster,
      backdrop: enrichedItem.backdrop,
      overview: enrichedItem.overview,
      year: enrichedItem.year,
      rating: enrichedItem.rating,
      seasons: (enrichedItem as any).seasons,
    });
  }, [setPlayerMedia]);

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

  if (error) {
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

  const hero = trending[0];

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {/* HERO */}
      {hero && (
        <Hero item={hero} onPlay={handlePlay} onMoreInfo={handlePosterClick} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Trending */}
        <Section
          title="Trending Minggu Ini"
          icon={<TrendingUp className="h-5 w-5 text-red-500" />}
          items={trending}
          onItemClick={handlePosterClick}
        />

        {/* Now Playing */}
        <Section
          title="Sedang Tayang di Bioskop"
          icon={<Film className="h-5 w-5 text-blue-500" />}
          items={nowPlaying}
          onItemClick={handlePosterClick}
        />

        {/* Popular Movies */}
        <Section
          title="Film Populer"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          items={popularMovies}
          onItemClick={handlePosterClick}
        />

        {/* Popular TV */}
        <Section
          title="Series Populer"
          icon={<Tv className="h-5 w-5 text-purple-500" />}
          items={popularTV}
          onItemClick={handlePosterClick}
        />

        {/* Top Rated Movies */}
        <Section
          title="Film Rating Tertinggi"
          icon={<Award className="h-5 w-5 text-yellow-500" />}
          items={topRated}
          onItemClick={handlePosterClick}
        />

        {/* Top Rated TV */}
        <Section
          title="Series Rating Tertinggi"
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          items={topRatedTV}
          onItemClick={handlePosterClick}
        />

        {/* Action */}
        <Section
          title="Action"
          icon={<Sparkles className="h-5 w-5 text-red-500" />}
          items={actionMovies}
          onItemClick={handlePosterClick}
        />

        {/* Comedy */}
        <Section
          title="Comedy"
          icon={<Sparkles className="h-5 w-5 text-green-500" />}
          items={comedyMovies}
          onItemClick={handlePosterClick}
        />
      </div>

      <Footer />
    </div>
  );
}

// ============================================================
// HERO
// ============================================================
function Hero({
  item, onPlay, onMoreInfo,
}: {
  item: MediaItem;
  onPlay: (i: MediaItem) => void;
  onMoreInfo: (i: MediaItem) => void;
}) {
  return (
    <div className="relative h-[70vh] min-h-[500px] w-full overflow-hidden">
      <img
        src={item.backdrop}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14 lg:p-16">
        <div className="max-w-2xl">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <Flame className="h-3 w-3" /> Trending
          </span>

          <h1 className="text-3xl font-black leading-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl">
            {item.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {item.rating > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 font-semibold text-yellow-400">
                <Star className="h-3.5 w-3.5 fill-yellow-400" />
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.year && <span className="text-white/80">{item.year}</span>}
            <span className="rounded border border-white/30 px-2 py-0.5 text-xs uppercase text-white/80">
              {item.type === "tv" ? "TV Series" : "Movie"}
            </span>
          </div>

          {item.overview && (
            <p className="mt-4 max-w-xl text-sm text-white/80 line-clamp-3 sm:text-base md:text-lg">
              {item.overview}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => onPlay(item)}
              className="flex items-center gap-2 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition hover:bg-white/90 active:scale-95"
            >
              <Play className="h-5 w-5 fill-black" />
              Putar Sekarang
            </button>
            <button
              onClick={() => onMoreInfo(item)}
              className="flex items-center gap-2 rounded-md bg-white/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
            >
              Info Selengkapnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION (horizontal scroll)
// ============================================================
function Section({
  title, icon, items, onItemClick,
}: {
  title: string;
  icon?: React.ReactNode;
  items: MediaItem[];
  onItemClick: (i: MediaItem) => void;
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
          {icon}
          {title}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
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
          <MediaCard
            key={`${item.id}-${idx}`}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// MEDIA CARD
// ============================================================
function MediaCard({
  item, onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative block w-[140px] shrink-0 text-left sm:w-[160px] md:w-[180px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5 transition group-hover:ring-2 group-hover:ring-white/30">
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
        />

        {/* Badges */}
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {item.rating > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-yellow-400" />
              {item.rating.toFixed(1)}
            </span>
          )}
          <span className="rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/80 backdrop-blur-sm">
            {item.type === "tv" ? "TV" : "Film"}
          </span>
        </div>

        {/* Hover overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110">
              <Play className="h-6 w-6 fill-black text-black" />
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase text-white">
              Lihat Detail
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">
          {item.title}
        </p>
        <p className="mt-0.5 text-[10px] text-white/50">
          {item.year || "—"}
          {item.rating > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              • <Star className="h-2 w-2 fill-yellow-500 text-yellow-500" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}
