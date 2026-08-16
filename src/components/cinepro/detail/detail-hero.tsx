"use client";

import { Play, Bookmark, Check, Share2, Film, Loader2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { wrapImage, type VPSContent } from "./types";

interface DetailHeroProps {
  content: VPSContent;
  isTV: boolean;
  inWatchlist: boolean;
  watchlistLoading: boolean;
  onPlay: () => void;
  onToggleWatchlist: () => void;
  onShare: () => void;
  onTrailer: () => void;
}

export function DetailHero({
  content,
  isTV,
  inWatchlist,
  watchlistLoading,
  onPlay,
  onToggleWatchlist,
  onShare,
  onTrailer,
}: DetailHeroProps) {
  const title = content.title || "Untitled";
  const poster = wrapImage(content.poster_url);

  return (
    <>
      {/* === Hero Section === */}
      <div className="relative h-[22vh] min-h-[140px] w-full overflow-hidden bg-muted sm:h-[30vh] md:aspect-video md:h-auto">
        {poster && (
          <img
            src={poster}
            alt={title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 pr-12 sm:p-6 md:p-8">
          <Badge className="mb-1 bg-primary text-primary-foreground sm:mb-2">
            {isTV ? "TV Series" : "Movie"}
          </Badge>
          {content.age_limit && (
            <Badge className="mb-1 ml-1 bg-orange-600 text-white sm:mb-2">
              {content.age_limit}
            </Badge>
          )}
          {content.quality && (
            <Badge className="mb-1 ml-1 bg-secondary text-secondary-foreground sm:mb-2">
              {content.quality}
            </Badge>
          )}
          <h2 className="text-lg font-extrabold tracking-tight text-white drop-shadow-lg sm:text-2xl md:text-4xl">
            {title}
          </h2>
        </div>
      </div>

      {/* === Action bar: Save (left) | Play (center) | Trailer (right) === */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-3 sm:gap-3 sm:px-6 md:px-8">
        {/* Save - LEFT */}
        <Button
          size="icon"
          variant="outline"
          onClick={onToggleWatchlist}
          disabled={watchlistLoading}
          className={inWatchlist ? "border-primary text-primary" : ""}
          aria-label="Save to watchlist"
        >
          {watchlistLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : inWatchlist ? (
            <Check className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>

        {/* Play - CENTER (main CTA) */}
        <Button
          size="sm"
          onClick={onPlay}
          className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700 sm:size-lg"
        >
          <Play className="h-4 w-4 fill-current" />
          <span className="text-xs sm:text-sm">Play</span>
        </Button>

        {/* Trailer - RIGHT */}
        {content.trailer_url && (
          <Button
            size="sm"
            variant="outline"
            onClick={onTrailer}
            className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
          >
            <Clapperboard className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Trailer</span>
          </Button>
        )}

        {/* Share - far right */}
        <Button
          size="icon"
          variant="outline"
          aria-label="Share"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
