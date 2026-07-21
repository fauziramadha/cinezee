"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, Film, Tv, Clock, Flame,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { MovieCard } from "@/components/cinepro/movie-card";

const TMDB_IMG = "https://image.tmdb.org/t/p";

interface MediaItem {
  id: string;
  tmdbId: number;
  imdbId?: string;
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  logo?: string;
  overview: string;
  year: string;
  rating: number;
  genre?: string;
  seasons?: Array<{ seasonNumber: number; episodeCount: number; name?: string }>;
}

interface EpisodeItem {
  showTmdbId: number;
  showImdbId: string | null;
  showTitle: string;
  season: string;
  episode: string;
  episodeTitle: string;
  airDate: string;
  embedUrl: string;
  still?: string;
  overview?: string;
}

export default function HomePage() {
  const { setPlayerMedia, setDetailMedia } = useAppStore();

  const [data, setData] = useState<{
    hero: MediaItem[];
    movies: MediaItem[];
    popularMovies: MediaItem[];
    tvShows: MediaItem[];
    episodes: EpisodeItem[];
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
    if (!item.imdbId) {
      alert("Film ini tidak memiliki IMDB ID, tidak bisa diputar.");
      return;
    }
    setPlayerMedia({
      id: item.imdbId || item.id,
      imdbId: item.imdbId,
      tmdbId: item.tmdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      seasons: item.seasons,
    });
  }, [setPlayerMedia]);

  const handleDetail = useCallback((item: MediaItem) => {
    setDetailMedia({
      id: item.imdbId || item.id,
      tmdbId: item.tmdbId,
      imdbId: item.imdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      seasons: item.seasons,
    });
  }, [setDetailMedia]);

  const handlePlayEpisode = useCallback((ep: EpisodeItem) => {
    if (!ep.showImdbId) return;
    setPlayerMedia({
      id: ep.showImdbId || `tmdb-${ep.showTmdbId}`,
      imdbId: ep.showImdbId,
      tmdbId: ep.showTmdbId,
      title: `${ep.showTitle} - S${ep.season}E${ep.episode}`,
      type: "tv",
      poster: "",
      backdrop: "",
      overview: ep.overview || ep.episodeTitle,
      year: (ep.airDate || "").slice(0, 4),
      rating: 0,
      seasons: [{
        seasonNumber: parseInt(ep.season) || 1,
        episodeCount: parseInt(ep.episode) || 1,
        name: `Season ${ep.season}`,
      }],
      _currentSeason: ep.season,
      _currentEpisode: ep.episode,
    } as any);
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
        <Section title="Film Terbaru" icon={<Film className="h-5 w-5 text-red-500" />} items={data.movies} onItemClick={handleDetail} />
        <Section title="Film Populer" icon={<Flame className="h-5 w-5 text-orange-500" />} items={data.popularMovies} onItemClick={handleDetail} />
        <Section title="Series Terbaru" icon={<Tv className="h-5 w-5 text-purple-500" />} items={data.tvShows} onItemClick={handleDetail} />
        {data.episodes.length > 0 && (
          <EpisodeSection episodes={data.episodes} onPlay={handlePlayEpisode} />
        )}
      </div>

      <Footer />
    </div>
  );
}

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
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          {icon}{title}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => scroll("left")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, idx) => (
          <MovieCard key={`${item.id}-${idx}`} item={item} onClick={onItemClick} />
        ))}
      </div>
    </section>
  );
}

function EpisodeSection({ episodes, onPlay }: {
  episodes: EpisodeItem[];
  onPlay: (ep: EpisodeItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          <Clock className="h-5 w-5 text-blue-500" />Episode Terbaru
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => scroll("left")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {episodes.map((e, i) => (
          <EpisodeCard key={`${e.showTmdbId}-${e.season}-${e.episode}-${i}`} episode={e} onClick={() => onPlay(e)} />
        ))}
      </div>
    </section>
  );
}

function EpisodeCard({ episode, onClick }: { episode: EpisodeItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-[200px] shrink-0 flex-col gap-2 rounded-md bg-zinc-900 p-2 text-left transition hover:bg-zinc-800 sm:w-[240px]">
      <div className="relative aspect-video overflow-hidden rounded bg-zinc-800">
        {episode.still ? (
          <img src={episode.still} alt={`${episode.showTitle} S${episode.season}E${episode.episode}`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 fill-white/80 text-white/80" />
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          S{episode.season}E{episode.episode}
        </span>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <Play className="h-8 w-8 fill-white text-white" />
        </div>
      </div>
      <div>
        <p className="line-clamp-1 text-xs font-medium text-white">{episode.showTitle}</p>
        <p className="line-clamp-1 text-[10px] text-white/50">{episode.episodeTitle}</p>
        <p className="mt-0.5 text-[10px] text-white/40">{episode.airDate}</p>
      </div>
    </button>
  );
}
