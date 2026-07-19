"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Star, Flame } from "lucide-react";
import { useAppStore } from "@/lib/store";

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

const SLIDE_DURATION = 7000; // 7 detik per slide

export function HeroCarousel({
  items,
  onPlay,
  onMoreInfo,
}: {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const { setDetailMedia } = useAppStore();

  const goToNext = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % items.length);
    setProgress(0);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + items.length) % items.length);
    setProgress(0);
  }, [items.length]);

  // Auto-advance with progress bar
  useEffect(() => {
    if (isPaused || items.length === 0) return;

    // Progress bar animation (update setiap 50ms)
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (50 / SLIDE_DURATION) * 100;
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 50);

    // Auto-advance
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % items.length);
      setProgress(0);
    }, SLIDE_DURATION);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, items.length, currentIdx]);

  // Reset progress when slide changes manually
  useEffect(() => {
    setProgress(0);
  }, [currentIdx]);

  if (items.length === 0) return null;

  const current = items[currentIdx];

  return (
    <div
      className="relative h-[70vh] min-h-[500px] w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* === Background images (all slides, fade transition) === */}
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: idx === currentIdx ? 1 : 0 }}
        >
          <img
            src={item.backdrop}
            alt={item.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = item.poster;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
        </div>
      ))}

      {/* === Content === */}
      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14 lg:p-16">
        <div className="max-w-2xl">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <Flame className="h-3 w-3" /> Trending
          </span>

          {/* === TMDB Logo atau Judul === */}
          {current.logo ? (
            <img
              src={current.logo}
              alt={current.title}
              className="mb-3 h-16 w-auto max-w-[80%] object-contain object-left drop-shadow-2xl sm:h-20 md:h-28"
            />
          ) : (
            <h1 className="mb-3 text-3xl font-black leading-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl">
              {current.title}
            </h1>
          )}

          {/* === Meta info: rating, year, type, genre === */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            {current.rating > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 font-semibold text-yellow-400">
                <Star className="h-3.5 w-3.5 fill-yellow-400" />
                {current.rating.toFixed(1)}
              </span>
            )}
            {current.year && <span className="text-white/80">{current.year}</span>}
            <span className="rounded border border-white/30 px-2 py-0.5 text-xs uppercase text-white/80">
              {current.type === "tv" ? "TV Series" : "Movie"}
            </span>
            {current.genre && <span className="text-white/60 text-xs">{current.genre}</span>}
          </div>

          {/* === Synopsis === */}
          {current.overview && (
            <p className="mb-5 max-w-xl text-sm text-white/80 line-clamp-3 sm:text-base md:text-lg">
              {current.overview}
            </p>
          )}

          {/* === CTA buttons === */}
          <div className="flex gap-3">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center gap-2 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition hover:bg-white/90 active:scale-95"
            >
              <Play className="h-5 w-5 fill-black" />
              Putar Sekarang
            </button>
            <button
              onClick={() => onMoreInfo(current)}
              className="flex items-center gap-2 rounded-md bg-white/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
            >
              Info Selengkapnya
            </button>
          </div>
        </div>
      </div>

      {/* === Dots indicator + Progress bar === */}
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className="flex gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => { setCurrentIdx(idx); setProgress(0); }}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIdx ? "w-8 bg-white/30" : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Slide ${idx + 1}`}
            >
              {idx === currentIdx && (
                <div
                  className="h-full rounded-full bg-red-600"
                  style={{ width: `${progress}%` }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* === Navigation arrows (desktop only) === */}
      <button
        onClick={goToPrev}
        className="absolute left-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 md:flex"
        aria-label="Previous slide"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 md:flex"
        aria-label="Next slide"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
