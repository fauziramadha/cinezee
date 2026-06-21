"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "./movie-card";
import { cn } from "@/lib/utils";
import type { Movie } from "@/lib/tmdb";

interface ContentRowProps {
  title: string;
  movies: Movie[];
  className?: string;
}

export function ContentRow({ title, movies, className }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!movies.length) return null;

  return (
    <section className={cn("group/row relative", className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
          {title}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground sm:h-8 sm:w-8"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="content-row flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8"
        style={{ scrollbarWidth: "none" }}
      >
        {movies.map((movie) => (
          <MovieCard key={`${movie.id}-${movie.media_type || "m"}`} movie={movie} />
        ))}
        {/* Spacer at end */}
        <div className="w-1 shrink-0" />
      </div>
    </section>
  );
}
