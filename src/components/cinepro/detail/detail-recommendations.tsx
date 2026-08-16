"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Star, Sparkles } from "lucide-react";
import { wrapImage, type RecommendationItem } from "./types";

interface DetailRecommendationsProps {
  recommendations: RecommendationItem[];
  onItemClick: (item: RecommendationItem) => void;
}

export function DetailRecommendations({
  recommendations,
  onItemClick,
}: DetailRecommendationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          We Recommend
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {recommendations.map((item, idx) => {
          const poster = wrapImage(item.poster_url);
          const rating = item.rating ? item.rating.toFixed(1) : null;
          return (
            <button
              key={`${item.cinemacity_id}-${idx}`}
              onClick={() => onItemClick(item)}
              className="group/card w-32 shrink-0 overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary/50 sm:w-36 md:w-40"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                <img
                  src={poster}
                  alt={item.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-poster.png";
                  }}
                />
                {rating && (
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/80 px-1.5 py-0.5 backdrop-blur-sm">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-[10px] font-semibold text-white">{rating}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 pt-6">
                  {item.release_year && (
                    <span className="text-[9px] font-medium text-white/80">
                      {item.release_year}
                    </span>
                  )}
                  <h4 className="line-clamp-1 text-[11px] font-semibold text-white sm:text-xs">
                    {item.title}
                  </h4>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
