"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Play, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { cn } from "@/lib/utils";

interface HeroCarouselProps {
  movies: Movie[];
}

export function HeroCarousel({ movies }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
  });
  const [selected, setSelected] = useState(0);
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);
  const openPlayer = useAppStore((s) => s.openPlayer);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 8000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!movies.length) return null;

  // Take first 5 for hero
  const heroMovies = movies.slice(0, 5);

  const handlePlay = (movie: Movie) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    openPlayer({
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    });
  };

  const handleInfo = (movie: Movie) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    const selected: SelectedMedia = {
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    };
    setSelectedMedia(selected);
  };

  return (
    <section className="relative h-[70vh] min-h-[480px] w-full overflow-hidden md:h-[85vh]">
      {/* Embla viewport */}
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {heroMovies.map((movie, idx) => {
            const title = movie.title || movie.name || "Untitled";
            const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
            const rating = movie.vote_average?.toFixed(1) || "N/A";
            const mediaType: "movie" | "tv" =
              movie.media_type || (movie.title ? "movie" : "tv");

            return (
              <div
                key={movie.id}
                className="relative min-w-0 flex-[0_0_100%]"
              >
                {/* Backdrop image */}
                <div className="absolute inset-0">
                  {movie.backdrop_path && (
                    <Image
                      src={getImageUrl(movie.backdrop_path, "original")}
                      alt={title}
                      fill
                      priority={idx === 0}
                      sizes="100vw"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>

                {/* Gradient overlays */}
                <div className="hero-gradient absolute inset-0" />
                <div className="hero-gradient-left absolute inset-0" />

                {/* Content */}
                <div className="relative z-10 flex h-full items-end md:items-center">
                  <div className="w-full max-w-2xl px-4 pb-12 sm:px-6 md:pb-0 md:pl-8 lg:pl-12">
                    {/* Media type badge */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        {mediaType === "tv" ? "TV Series" : "Movie"}
                      </span>
                      {rating !== "N/A" && (
                        <span className="flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {rating}
                        </span>
                      )}
                      {year && (
                        <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                          {year}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h1
                      className="slide-in text-3xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl"
                      key={`title-${selected}`}
                    >
                      {title}
                    </h1>

                    {/* Overview */}
                    <p className="mt-3 line-clamp-3 max-w-xl text-sm text-white/80 drop-shadow sm:text-base md:line-clamp-4 md:text-lg">
                      {movie.overview}
                    </p>

                    {/* Buttons */}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        size="lg"
                        onClick={() => handlePlay(movie)}
                        className="h-11 gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        Play Now
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => handleInfo(movie)}
                        className="h-11 gap-2 bg-white/15 px-6 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/25 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Info className="h-5 w-5" />
                        More Info
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={scrollPrev}
        className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-primary md:flex"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots indicator */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 md:bottom-6">
        {heroMovies.map((_, idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              idx === selected
                ? "w-6 bg-primary"
                : "w-1.5 bg-white/40 hover:bg-white/60",
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
