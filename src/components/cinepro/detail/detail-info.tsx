"use client";

import { Star, Calendar, Clock, Globe, Film, User, Users, Building, Shield } from "lucide-react";
import { type VPSContent, type Episode } from "./types";

interface DetailInfoProps {
  content: VPSContent;
  isTV: boolean;
  seasons: number[];
  allEpisodes: Episode[];
  rating: string;
  avgUserRating: string | null;
  year: string;
  overview: string;
}

export function DetailInfo({
  content,
  isTV,
  seasons,
  allEpisodes,
  rating,
  avgUserRating,
  year,
  overview,
}: DetailInfoProps) {
  // Parse genres (could be array or string)
  const genres: string[] = Array.isArray(content.genres)
    ? content.genres
    : typeof content.genres === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(content.genres);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <div className="space-y-6">
      {/* === Meta info bar === */}
      <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-sm">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
          <span className="font-semibold">{rating}</span>
        </span>
        {avgUserRating && (
          <span className="flex items-center gap-1 text-primary">
            <Star className="h-3.5 w-3.5 fill-primary text-primary sm:h-4 sm:w-4" />
            <span className="font-semibold">{avgUserRating}</span>
            <span className="text-muted-foreground">User</span>
          </span>
        )}
        {year && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {year}
          </span>
        )}
        {content.runtime && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {content.runtime}
          </span>
        )}
        {content.age_limit && (
          <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            <Shield className="h-3 w-3" />
            {content.age_limit}
          </span>
        )}
        {content.quality && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">
            {content.quality}
          </span>
        )}
      </div>

      {/* === Overview === */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          Overview
        </h3>
        <p className="break-words text-xs leading-relaxed text-foreground/90 sm:text-sm md:text-base">
          {overview}
        </p>
      </div>

      {/* === 3 Column Info Grid: About | Persons | Production === */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* About */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Film className="h-3.5 w-3.5" />
            About
          </h4>
          <div className="space-y-1.5 text-xs sm:text-sm">
            {genres.length > 0 && (
              <InfoRow label="Genre" value={genres.join(", ")} />
            )}
            {year && <InfoRow label="Year" value={year} />}
            {content.runtime && <InfoRow label="Runtime" value={content.runtime} />}
            {content.age_limit && <InfoRow label="Age Limit" value={content.age_limit} />}
            {isTV && seasons.length > 0 && (
              <InfoRow label="Seasons" value={String(seasons.length)} />
            )}
            {isTV && allEpisodes.length > 0 && (
              <InfoRow label="Episodes" value={String(allEpisodes.length)} />
            )}
          </div>
        </div>

        {/* Persons */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Users className="h-3.5 w-3.5" />
            Persons
          </h4>
          <div className="space-y-1.5 text-xs sm:text-sm">
            {content.director && <InfoRow label="Director" value={content.director} />}
            {content.writer && <InfoRow label="Writer" value={content.writer} />}
            {content.stars && (
              <InfoRow label="Stars" value={content.stars} multiline />
            )}
          </div>
        </div>

        {/* Production */}
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Building className="h-3.5 w-3.5" />
            Production
          </h4>
          <div className="space-y-1.5 text-xs sm:text-sm">
            {content.country && <InfoRow label="Country" value={content.country} />}
            {!content.country && (
              <p className="text-xs text-muted-foreground/60">No production info</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={multiline ? "block mt-0.5 text-foreground/90" : "text-foreground/90"}>
        {value}
      </span>
    </div>
  );
}
