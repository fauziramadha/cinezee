"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface Top10RowProps {
  title: string;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
  className?: string;
}

export function Top10Row({ title, items, onItemClick, className }: Top10RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  const top10 = items.slice(0, 10);

  return (
    <section className={cn("group/row relative", className)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {title}
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

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {top10.map((item, idx) => {
          const rank = idx + 1;
          const title = item.title || "Untitled";
          const year = item.year || "";
          const rating = item.rating?.toFixed(1) || null;
          const mediaType = item.type || "movie";

          return (
            <button
              key={`top10-${item.id}-${idx}`}
              onClick={() => onItemClick(item)}
              className="group/card relative flex shrink-0 items-end"
            >
              {/* Large rank number - Netflix style */}
              <span
                className="select-none font-black leading-none"
                style={{
                  fontSize: "7rem",
                  color: "#dc2626",
                  opacity: 0.5,
                  fontWeight: 900,
                  marginRight: "-1.2rem",
                  marginBottom: "-0.3rem",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: "-0.08em",
                  textShadow: "2px 2px 0 #000",
                  zIndex: 1,
                  lineHeight: 0.8,
                }}
              >
                {rank}
              </span>

              {/* Poster card */}
              <div className="relative w-32 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-lg ring-1 ring-white/10 transition-all group-hover/card:ring-2 group-hover/card:ring-red-600 sm:w-36 md:w-40">
                {/* Poster image */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                  {item.poster && !item.poster.includes("placeholder") ? (
                    <img
                      src={item.poster}
                      alt={title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-poster.png";
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-zinc-900">
                      <span className="text-xs text-white/40">No Image</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600/90 backdrop-blur-sm">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </div>
                  </div>

                  {/* Rating badge (top-right) */}
                  {rating && parseFloat(rating) > 0 && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/80 px-1.5 py-0.5 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] font-semibold text-white">{rating}</span>
                    </div>
                  )}

                  {/* Type badge + title (bottom) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-8">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-red-600/90 px-1 text-[8px] font-bold uppercase text-white">
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
