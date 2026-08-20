"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Play, History } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

export function WatchHistory() {
  const { history, removeFromHistory, clearHistory, openPlayer, loadHistory } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadHistory();
    setMounted(true);
  }, [loadHistory]);

  if (!mounted || history.length === 0) return null;

  const handleResume = (item: any) => {
    openPlayer({
      id: item.id,
      type: item.type,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      slug: item.slug,
      source: item.source,
    }, item.season, item.episode);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section className="relative z-10 px-4 pt-2 pb-4 sm:px-6 md:px-8">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold sm:text-lg">Continue Watching</h2>
        <button
          onClick={clearHistory}
          className="ml-auto text-[10px] text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          Clear All
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        <style>{`section::-webkit-scrollbar { display: none; }`}</style>
        
        {history.map((item) => {
          const progressPercent = item.progress && item.duration
            ? (item.progress / item.duration) * 100
            : 0;

          return (
            <div
              key={`${item.id}-${item.season || ""}-${item.episode || ""}`}
              className="group relative aspect-video w-64 shrink-0 overflow-hidden rounded-lg bg-card sm:w-80"
            >
              <button
                onClick={() => handleResume(item)}
                className="absolute inset-0 z-10 h-full w-full"
                aria-label={`Resume ${item.title}`}
              />

              {item.backdropPath ? (
                <Image
                  src={getImageUrl(item.backdropPath, "w500")}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 256px, 320px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-muted">
                  <span className="text-xs text-muted-foreground">No Image</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

              {/* Play Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm">
                  <Play className="h-5 w-5 fill-white text-white" />
                </div>
              </div>

              {/* Info & Progress */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-white">
                  {item.title}
                </h3>
                {(item.season || item.episode) && (
                  <p className="text-[10px] text-white/60">
                    {item.season ? `S${item.season}` : ""}{item.episode ? ` E${item.episode}` : ""}
                    {item.progress && item.duration ? ` • ${formatTime(item.progress)} / ${formatTime(item.duration)}` : ""}
                  </p>
                )}
                
                {/* Progress Bar */}
                {progressPercent > 0 && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(item.id);
                }}
                className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
