"use client";

import { useState } from "react";
import { Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { useAppStore, type SelectedMedia } from "@/lib/store";

// ============================================================
// MediaItem interface (kompatibel dengan page.tsx baru)
// ============================================================
interface MediaItem {
  id: string | number;
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

interface MovieCardProps {
  // === Props baru (page.tsx baru) ===
  item?: MediaItem;
  onClick?: (item: MediaItem) => void;
  // === Props lama (backward-compat) ===
  movie?: Movie;
  className?: string;
  size?: "sm" | "md" | "lg";
  type?: "movie" | "tv";
}

const sizeClasses = {
  sm: "w-[120px] sm:w-[130px]",
  md: "w-[140px] sm:w-[160px] md:w-[180px]",
  lg: "w-[160px] sm:w-[180px] md:w-[200px]",
};

// Helper: dapatkan poster URL dari MediaItem (sudah full URL) atau Movie (perlu getImageUrl)
function getPosterUrl(item?: MediaItem, movie?: Movie): string {
  if (item?.poster) return item.poster;
  if (movie?.poster_path) return getImageUrl(movie.poster_path, "w500");
  return "/placeholder-poster.png";
}

function getBackdropUrl(item?: MediaItem, movie?: Movie): string {
  if (item?.backdrop) return item.backdrop;
  if (movie?.backdrop_path) return getImageUrl(movie.backdrop_path, "w1280");
  return "";
}

export function MovieCard({ item, onClick, movie, className, size = "md", type }: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);

  // === Normalize: pakai item (baru) atau movie (lama) ===
  const useItem = !!item;
  const source = item || (movie as any);

  const title = useItem
    ? (item!.title || "Untitled")
    : (movie?.title || movie?.name || "Untitled");
  const year = useItem
    ? (item!.year || "")
    : (movie?.release_date || movie?.first_air_date || "").split("-")[0];
  const rating = useItem
    ? (item!.rating?.toFixed(1) || "N/A")
    : (movie?.vote_average?.toFixed(1) || "N/A");
  const mediaType: "movie" | "tv" = useItem
    ? (item!.type || "movie")
    : (type || movie?.media_type || (movie?.title ? "movie" : "tv"));

  const posterUrl = getPosterUrl(item, movie);
  const backdropUrl = getBackdropUrl(item, movie);

  const handleClick = () => {
    if (useItem && onClick) {
      // === Mode baru: panggil onClick dari parent ===
      onClick(item!);
      return;
    }

    // === Mode lama: set selectedMedia langsung (backward-compat) ===
    if (movie) {
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
    } else if (item) {
      // Fallback kalau item ada tapi onClick tidak
      const selected: SelectedMedia = {
        id: item.tmdbId,
        type: item.type,
        title: item.title,
        posterPath: undefined,
        backdropPath: undefined,
      } as SelectedMedia;
      setSelectedMedia(selected);
    }
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
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted/60" />
        )}
        {posterUrl && !posterUrl.includes("placeholder") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
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

      {/* Title (overlay di bawah poster) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-8">
        <h3 className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">
          {title}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/70">
          <span className="uppercase tracking-wide">{mediaType}</span>
          {year && (
            <>
              <span>•</span>
              <span>{year}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
