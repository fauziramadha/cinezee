"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Star, Flame } from "lucide-react";

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

const SLIDE_DURATION = 7000;

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs untuk touch swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goToNext = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % items.length);
    setProgress(0);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + items.length) % items.length);
    setProgress(0);
  }, [items.length]);

  const goToSlide = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setProgress(0);
  }, []);

  // Progress bar + auto-advance
  useEffect(() => {
    if (isPaused || items.length === 0) return;

    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (50 / SLIDE_DURATION) * 100;
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 50);

    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % items.length);
      setProgress(0);
    }, SLIDE_DURATION);

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, items.length, currentIdx]);

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      goToNext();
    } else if (touchEndX.current - touchStartX.current > 50) {
      goToPrev();
    }
    setIsPaused(false);
  };

  if (items.length === 0) return null;

  const current = items[currentIdx];

  return (
    <div
      className="relative h-[60vh] min-h-[400px] w-full overflow-hidden sm:h-[70vh] sm:min-h-[500px] touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background images */}
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: idx === currentIdx ? 1 : 0 }}
        >
          <img
            src={item.backdrop}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = item.poster;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-end p-4 pb-12 sm:p-10 sm:pb-14 md:p-14 md:pb-10 lg:p-16">
        <div className="max-w-2xl">
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:mb-3 sm:px-3 sm:py-1 sm:text-xs">
            <Flame className="h-3 w-3" /> Trending
          </span>

          {/* Title (always text, no logo) */}
          <h1 className="mb-2 text-2xl font-black leading-tight text-white drop-shadow-2xl sm:mb-3 sm:text-4xl md:text-5xl lg:text-7xl">
            {current.title}
          </h1>

          {/* Meta info */}
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:mb-3 sm:gap-3 sm:text-sm">
            {current.rating > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-1.5 py-0.5 font-semibold text-yellow-400 sm:px-2 sm:py-1">
                <Star className="h-3 w-3 fill-yellow-400 sm:h-3.5 sm:w-3.5" />
                {current.rating.toFixed(1)}
              </span>
            )}
            {current.year && <span className="text-white/80">{current.year}</span>}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase text-white/80 sm:px-2">
              {current.type === "tv" ? "TV Series" : "Movie"}
            </span>
            {current.quality && (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase text-white/80 sm:px-2">
                {current.quality}
              </span>
            )}
          </div>

          {/* Synopsis */}
          {current.overview && (
            <p className="mb-3 max-w-xl text-xs text-white/80 line-clamp-2 sm:mb-5 sm:text-sm sm:line-clamp-3 md:text-base md:line-clamp-3 lg:text-lg">
              {current.overview}
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-row gap-2 sm:gap-3">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95 sm:px-6 sm:py-2.5 sm:text-sm md:px-7 md:py-3 md:text-base"
            >
              <Play className="h-3.5 w-3.5 fill-white sm:h-4 sm:w-4 md:h-5 md:w-5" />
              <span className="whitespace-nowrap">Putar Sekarang</span>
            </button>
            <button
              onClick={() => onMoreInfo(current)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95 sm:px-5 sm:py-2.5 sm:text-sm md:px-6 md:py-3 md:text-base"
            >
              <span className="whitespace-nowrap">Info Selengkapnya</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dots indicator + Progress bar */}
      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 sm:bottom-4 md:bottom-6">
        <div className="flex gap-1.5 sm:gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-1 rounded-full transition-all ${
                idx === currentIdx ? "w-6 bg-white/30 sm:w-8" : "w-1.5 bg-white/40 hover:bg-white/60"
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

      {/* Navigation arrows (desktop only) */}
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
