"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { useAppStore, type SelectedMedia } from "@/lib/store";

interface MovieCardProps {
  movie: Movie;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-28 sm:w-32",
  md: "w-36 sm:w-40 md:w-44",
  lg: "w-44 sm:w-52 md:w-56",
};

export function MovieCard({ movie, className, size = "md" }: MovieCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);

  const title = movie.title || movie.name || "Untitled";
  const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
  const rating = movie.vote_average?.toFixed(1) || "N/A";
  const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");

  const handleClick = () => {
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
    <button
      onClick={handleClick}
      className={cn(
        "group relative shrink-0 overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary",
        sizeClasses[size],
        className,
      )}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted/60" />
        )}
        {movie.poster_path ? (
          <Image
            src={getImageUrl(movie.poster_path, "w500")}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className={cn(
              "object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setImageLoaded(true)}
            unoptimized
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

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      </div>

      {/* Title */}
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
