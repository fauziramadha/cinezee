"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Top10RowProps {
  title: string;
  movies: Movie[];
  className?: string;
}

export function Top10Row({ title, movies, className }: Top10RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!movies.length) return null;

  const top10 = movies.slice(0, 10);

  const handleClick = (movie: Movie) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    const selected: SelectedMedia = {
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      slug: (movie as any).slug,
      source: (movie as any).source,
    } as SelectedMedia;
    setSelectedMedia(selected);
  };

  return (
    <section className={cn("group/row relative", className)}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 px-4 sm:px-6 md:px-8">
        <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg md:text-xl">
          <span className="text-primary">🏆</span>
          {title}
        </h2>
        <div className="ml-auto hidden gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/row:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/row:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-6 md:px-8"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style>{`.top10-scroll::-webkit-scrollbar { display: none; }`}</style>

        {top10.map((movie, idx) => {
          const rank = idx + 1;
          const title = movie.title || movie.name || "Untitled";
          const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
          const rating = movie.vote_average?.toFixed(1) || null;
          const mediaType: "movie" | "tv" = movie.media_type || "movie";

          return (
            <button
              key={`top10-${movie.id}-${idx}`}
              onClick={() => handleClick(movie)}
              className="group/card relative flex shrink-0 items-end"
            >
              {/* Large rank number - Netflix style */}
              {/* FIX: pakai solid color + opacity (iOS Safari compatible) */}
              <span
                className="select-none font-black leading-none"
                style={{
                  fontSize: "7rem",
                  color: "hsl(var(--primary))",
                  opacity: 0.35,
                  fontWeight: 900,
                  marginRight: "-1.2rem",
                  marginBottom: "-0.3rem",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: "-0.08em",
                  textShadow: "2px 2px 0 hsl(var(--background))",
                  zIndex: 1,
                  lineHeight: 0.8,
                }}
              >
                {rank}
              </span>

              {/* Poster card */}
              <div className="relative w-32 shrink-0 overflow-hidden rounded-lg bg-card shadow-lg ring-1 ring-border transition-all group-hover/card:ring-2 group-hover/card:ring-primary sm:w-36 md:w-40">
                {/* Poster image */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                  {movie.poster_path ? (
                    <Image
                      src={getImageUrl(movie.poster_path, "w500")}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 144px, 176px"
                      className="object-cover transition-transform duration-300 group-hover/card:scale-110"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-muted">
                      <span className="text-xs text-muted-foreground">No Image</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </div>
                  </div>

                  {/* Rating badge (top-right) */}
                  {rating && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/80 px-1.5 py-0.5 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] font-semibold text-white">{rating}</span>
                    </div>
                  )}

                  {/* Type badge + title (bottom) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-8">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground">
                        {mediaType === "tv" ? "TV" : "Movie"}
                      </span>
                      {year && (
                        <span className="text-[9px] font-medium text-white/80">{year}</span>
                      )}
                    </div>
                    <h3 className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-white sm:text-xs">
                      {title}
                    </h3>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
