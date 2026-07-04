"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimeCardProps {
  anime: {
    title: string;
    poster?: string;
    episodes?: number;
    releaseDay?: string;
    latestReleaseDate?: string;
    animeId: string;
    href?: string;
    status?: string;
    type?: string;
    rating?: string | number;
  };
  variant?: "default" | "compact";
}

export function AnimeCard({ anime, variant = "default" }: AnimeCardProps) {
  const title = anime.title || "Untitled";
  const poster = anime.poster || null;
  const episodes = anime.episodes;
  const status = anime.status || (anime.releaseDay ? "Ongoing" : "Unknown");
  const animeId = anime.animeId;

  return (
    <Link
      href={`/anime/${animeId}`}
      className="group relative flex shrink-0 flex-col overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px"
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-xs">No Image</span>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm",
              status.toLowerCase().includes("ongoing")
                ? "bg-green-500/90 text-white"
                : status.toLowerCase().includes("tamat") || status.toLowerCase().includes("completed")
                ? "bg-blue-500/90 text-white"
                : "bg-black/70 text-white"
            )}
          >
            {status}
          </span>
        </div>

        {/* Episodes badge */}
        {episodes && (
          <div className="absolute right-1.5 top-1.5">
            <span className="flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              EP {episodes}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      </div>

      {/* Title & meta */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5 pt-8">
        <h3 className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">
          {title}
        </h3>
        {variant === "default" && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/70">
            {anime.releaseDay && (
              <span className="flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {anime.releaseDay}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
