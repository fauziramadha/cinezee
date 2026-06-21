"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Play, Trash2, History } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";

export function WatchHistory() {
  const { history, loadHistory, removeFromHistory, clearHistory, openPlayer } =
    useAppStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (history.length === 0) return null;

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight sm:text-lg md:text-xl">
          <History className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
          Continue Watching
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          Clear All
        </Button>
      </div>

      <div className="content-row flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8">
        {history.map((item) => (
          <div
            key={`${item.id}-${item.type}`}
            className="group relative aspect-video w-64 shrink-0 overflow-hidden rounded-lg bg-card sm:w-72"
          >
            {item.backdropPath ? (
              <Image
                src={getImageUrl(item.backdropPath, "w500")}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 100vw, 288px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <span className="text-xs text-muted-foreground">No Image</span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                  {item.type === "tv" ? "TV" : "Movie"}
                </span>
                {item.season && item.episode && (
                  <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    S{item.season} E{item.episode}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">
                {item.title}
              </h3>
            </div>

            {/* Hover actions */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <Button
                size="icon"
                onClick={() =>
                  openPlayer(item, item.season, item.episode)
                }
                className="h-12 w-12 rounded-full bg-primary/90 hover:bg-primary"
              >
                <Play className="h-5 w-5 fill-white text-white" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeFromHistory(item.id)}
                className="absolute right-2 top-2 h-7 w-7 bg-black/60 text-white hover:bg-destructive hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
