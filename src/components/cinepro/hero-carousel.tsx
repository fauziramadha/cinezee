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

const SLIDE_DURATION = 8000; // 8 detik per slide

export function HeroCarousel({ movies }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
  });
  const [selected, setSelected] = useState(0);
  const [logos, setLogos] = useState<Record<number, string | null>>({});
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

  // ============================================================
  // FIX #6: Fetch logos untuk semua hero movies (parallel)
  // ============================================================
  useEffect(() => {
    if (!movies.length) return;
    const heroMovies = movies.slice(0, 5);
    let cancelled = false;

    Promise.all(
      heroMovies.map((movie) => {
        const type = movie.media_type || (movie.title ? "movie" : "tv");
        return fetch(`/api/detail/${movie.id}?type=${type}`)
          .then((res) => res.json())
          .then((data) => {
            // Priority: English logo > any logo
            const logo =
              data.images?.logos?.find((l: any) => l.iso_639_1 === "en") ||
              data.images?.logos?.[0];
            return { id: movie.id, logoPath: logo?.file_path || null };
          })
          .catch(() => ({ id: movie.id, logoPath: null }));
      })
    ).then((results) => {
      if (cancelled) return;
      const logoMap: Record<number, string | null> = {};
      results.forEach((r) => {
        logoMap[r.id] = r.logoPath;
      });
      setLogos(logoMap);
    });

    return () => {
      cancelled = true;
    };
  }, [movies]);

  // ============================================================
  // ANIMASI PROGRESS BAR: Saat animation selesai → next slide
  // (Hapus setInterval lama, pakai onAnimationEnd sebagai trigger)
  // ============================================================
  const handleProgressEnd = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!movies.length) return null;

  const heroMovies = movies.slice(0, 5);

  const handlePlay = (movie: Movie) => {
    const mediaType: "movie" | "tv" =
      movie.media_type || (movie.title ? "movie" : "tv");
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
    const mediaType: "movie" | "tv" =
      movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    const selectedMedia: SelectedMedia = {
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    };
    setSelectedMedia(selectedMedia);
  };

  return (
    <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden md:h-[75vh] lg:h-[80vh]">
      {/* Embla viewport */}
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {heroMovies.map((movie, idx) => {
            const title = movie.title || movie.name || "Untitled";
            const year = (
              movie.release_date ||
              movie.first_air_date ||
              ""
            ).split("-")[0];
            const rating = movie.vote_average?.toFixed(1) || "N/A";
            const mediaType: "movie" | "tv" =
              movie.media_type || (movie.title ? "movie" : "tv");
            const logoPath = logos[movie.id];

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
                  <div className="w-full max-w-2xl px-4 pb-14 sm:px-6 md:pb-0 md:pl-8 lg:pl-12">
                    {/* Media type badge */}
                    <div className="mb-2 flex items-center gap-2 sm:mb-3">
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

                    {/* ============================================================ */}
                    {/* FIX #6: Judul pakai logo TMDB (fallback ke text)            */}
                    {/* ============================================================ */}
                    {logoPath ? (
                      <div
                        key={`logo-${selected}`}
                        className="slide-in relative h-12 w-auto max-w-[80%] sm:h-16 md:h-24 lg:h-28"
                      >
                        <Image
                          src={getImageUrl(logoPath, "w500")}
                          alt={title}
                          fill
                          className="object-contain object-left drop-shadow-2xl"
                          unoptimized
                          sizes="(max-width: 768px) 80vw, 500px"
                        />
                      </div>
                    ) : (
                      <h1
                        className="slide-in text-2xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-5xl lg:text-6xl"
                        key={`title-${selected}`}
                      >
                        {title}
                      </h1>
                    )}

                    {/* Overview */}
                    <p className="mt-2 line-clamp-2 max-w-xl text-xs text-white/80 drop-shadow sm:mt-3 sm:text-sm md:line-clamp-4 md:text-lg">
                      {movie.overview}
                    </p>

                    {/* Buttons */}
                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                      <Button
                        size="lg"
                        onClick={() => handlePlay(movie)}
                        className="h-9 gap-2 bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                        Play Now
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() => handleInfo(movie)}
                        className="h-9 gap-2 bg-white/15 px-4 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/25 sm:h-12 sm:px-8 sm:text-base"
                      >
                        <Info className="h-4 w-4 sm:h-5 sm:w-5" />
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

      {/* Navigation arrows - desktop only */}
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

      {/* ============================================================ */}
      {/* ANIMATED PROGRESS BARS                                        */}
      {/* Bar aktif: fill 0→100% selama SLIDE_DURATION                 */}
      {/* Saat penuh → onAnimationEnd → scrollNext() → reset            */}
      {/* ============================================================ */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-4 md:bottom-6">
        {heroMovies.map((_, idx) => (
          <div
            key={idx}
            className="h-1 w-8 overflow-hidden rounded-full bg-white/30 sm:w-10"
          >
            {/* Hanya slide aktif yang animasi */}
            {idx === selected && (
              <div
                key={`progress-${selected}`}
                className="h-full rounded-full bg-primary"
                style={{
                  width: "0%",
                  animation: `heroProgress ${SLIDE_DURATION}ms linear forwards`,
                }}
                onAnimationEnd={handleProgressEnd}
              />
            )}
          </div>
        ))}
      </div>

      {/* CSS Keyframes untuk progress animation */}
      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
