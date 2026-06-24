"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Play, Trash2, History, Loader2 } from "lucide-react";
import { useAppStore, type WatchHistoryItem } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function WatchHistory() {
  const { history, loadHistory, removeFromHistory, clearHistory, openPlayer } =
    useAppStore();
  const { data: session, status } = useSession();

  const [cloudHistory, setCloudHistory] = useState<WatchHistoryItem[]>([]);
  const [cloudHistoryRaw, setCloudHistoryRaw] = useState<any[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const isLoggedIn = status === "authenticated" && !!session?.user;

  // Fetch from D1 if logged in, else from localStorage
  useEffect(() => {
    if (isLoggedIn) {
      setLoadingCloud(true);
      fetch("/api/history")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            // Keep raw data for deletion (need database record ID)
            setCloudHistoryRaw(data.history || []);
            // Map to WatchHistoryItem format
            // IMPORTANT: id = mediaId (TMDB ID, number) for player to work!
            const mapped: WatchHistoryItem[] = (data.history || []).map((item: any) => ({
              id: item.mediaId,
              type: item.mediaType,
              title: item.title,
              posterPath: item.posterPath,
              backdropPath: item.backdropPath,
              watchedAt: item.updatedAt,
              progress: item.progress,
              season: item.season,
              episode: item.episode,
            }));
            setCloudHistory(mapped);
          }
        })
        .catch(() => toast.error("Gagal memuat riwayat tontonan"))
        .finally(() => setLoadingCloud(false));
    } else {
      loadHistory();
    }
  }, [isLoggedIn, loadHistory]);

  const displayHistory = isLoggedIn ? cloudHistory : history;

  const handleRemove = async (mediaId: number) => {
    if (isLoggedIn) {
      // Find database record ID from raw data
      const rawItem = cloudHistoryRaw.find((item) => item.mediaId === mediaId);
      if (!rawItem) return;
      try {
        await fetch(`/api/history?id=${rawItem.id}`, { method: "DELETE" });
        setCloudHistory((prev) => prev.filter((item) => item.id !== mediaId));
        setCloudHistoryRaw((prev) => prev.filter((item) => item.mediaId !== mediaId));
        toast.success("Dihapus dari riwayat");
      } catch {
        toast.error("Gagal menghapus");
      }
    } else {
      removeFromHistory(mediaId);
    }
  };

  const handleClearAll = async () => {
    if (isLoggedIn) {
      try {
        await fetch(`/api/history?clear=all`, { method: "DELETE" });
        setCloudHistory([]);
        setCloudHistoryRaw([]);
        toast.success("Riwayat dibersihkan");
      } catch {
        toast.error("Gagal membersihkan riwayat");
      }
    } else {
      clearHistory();
    }
  };

  if (displayHistory.length === 0 && !loadingCloud) return null;

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight sm:text-lg md:text-xl">
          <History className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
          Continue Watching
        </h2>
        {displayHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear All
          </Button>
        )}
      </div>

      {loadingCloud ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="content-row flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8">
          {displayHistory.map((item) => (
            <div
              key={`${item.id}-${item.type}`}
              className="group relative aspect-video w-64 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-card sm:w-72"
              onClick={() => openPlayer(item, item.season, item.episode)}
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

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Play icon - always visible on mobile, hover on desktop */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 group-hover:bg-black/50 sm:bg-transparent sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                  <Play className="h-5 w-5 fill-white text-white" />
                </div>
              </div>

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

              {/* Delete button - stop propagation so it doesn't trigger play */}
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item.id);
                }}
                className="absolute right-2 top-2 z-10 h-7 w-7 bg-black/60 text-white opacity-100 transition-opacity hover:bg-destructive hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
