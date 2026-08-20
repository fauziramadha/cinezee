"use client";

import { useState } from "react";
import { Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// MediaItem interface - Pure VPS API (No TMDB)
// ============================================================
export interface MediaItem {
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

interface MovieCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-[120px] sm:w-[130px]",
  md: "w-[140px] sm:w-[160px] md:w-[180px]",
  lg: "w-[160px] sm:w-[180px] md:w-[200px]",
};

export function MovieCard({ item, onClick, className, size = "md" }: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const title = item.title || "Untitled";
  const year = item.year || "";
  const rating = item.rating?.toFixed(1) || "N/A";
  const mediaType: "movie" | "tv" = item.type || "movie";
  const posterUrl = item.poster || "/placeholder-poster.png";

  const handleClick = () => {
    onClick(item);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary",
        sizeClasses[size],
        className,
      )}
    >
      {/* FIX: Container flex column untuk tinggi yang konsisten */}
      <div className="flex h-full flex-col">
        
        {/* Poster Area (Aspect Ratio 2:3) */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted/60" />
          )}
          {posterUrl && !posterUrl.includes("placeholder") ? (
            <img
              src={posterUrl}
              alt={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300 group-hover:scale-105",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-poster.png";
                setImageLoaded(true);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span className="text-xs">No Image</span>
            </div>
          )}

          {/* Rating badge */}
          <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] font-semibold text-white">{rating}</span>
          </div>

          {/* Type badge */}
          <div className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="text-[9px] font-semibold uppercase text-white/80">
              {mediaType === "tv" ? "TV" : "Film"}
            </span>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm transition group-hover:scale-110">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
              <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase text-white">
                Lihat Detail
              </span>
            </div>
          </div>
        </div>

        {/* Text Area (Solid Background) */}
        <div className="mt-auto bg-zinc-900 p-2">
          <h3 className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">
            {title}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/60">
            <span className="uppercase tracking-wide">{mediaType}</span>
            {year && (
              <>
                <span>•</span>
                <span>{year}</span>
              </>
            )}
          </div>
        </div>
        
      </div>
    </button>
  );
}
