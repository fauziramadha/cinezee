"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Server,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { trackPlay } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { MovieDetail } from "@/lib/tmdb";

interface ProviderInfo {
  name: string;
  brutality: number;
  url: string;
}

export function PlayerModal() {
  const {
    playerMedia,
    playerSeason,
    playerEpisode,
    closePlayer,
  } = useAppStore();
  const { data: session, status } = useSession();

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [season, setSeason] = useState(playerSeason || 1);
  const [episode, setEpisode] = useState(playerEpisode || 1);

  // Save to watch history (only if logged in)
  const saveToHistory = useCallback(async () => {
    if (!playerMedia || status !== "authenticated" || !session?.user) return;

    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: playerMedia.id,
          mediaType: playerMedia.type,
          title: playerMedia.title,
          posterPath: playerMedia.posterPath,
          backdropPath: playerMedia.backdropPath,
          season: playerMedia.type === "tv" ? season : null,
          episode: playerMedia.type === "tv" ? episode : null,
          progress: 0,
        }),
      });
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.error("[SAVE HISTORY ERROR]", error);
    }
  }, [playerMedia, session, status, season, episode]);

  // Fetch providers when media changes
  useEffect(() => {
    if (!playerMedia) return;

    let cancelled = false;
    const params = new URLSearchParams({
      id: String(playerMedia.id),
      type: playerMedia.type,
    });
    if (playerMedia.type === "tv") {
      params.set("season", String(season));
      params.set("episode", String(episode));
    }

    const loadProviders = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setIframeLoaded(false);
      setIframeError(false);
      setCurrentIdx(0);

      try {
        const res = await fetch(`/api/providers?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setProviders(data.providers || []);
        setLoading(false);
        
        // Save to history after providers loaded successfully
        saveToHistory();
        
        // Track play event for analytics
        trackPlay(playerMedia.id, playerMedia.type, playerMedia.title);
      } catch {
        if (cancelled) return;
        setLoading(false);
        setIframeError(true);
      }
    };

    loadProviders();

    fetch(`/api/detail/${playerMedia.id}?type=${playerMedia.type}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [playerMedia, season, episode, saveToHistory]);

  // Reset iframe state when provider changes
  useEffect(() => {
    if (currentIdx === 0 && providers.length === 0) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setIframeLoaded(false);
      setIframeError(false);
    });
    return () => {
      cancelled = true;
    };
  }, [currentIdx, providers.length]);

  const currentProvider = providers[currentIdx];

  const handleIframeError = useCallback(() => {
    setIframeError(true);
    setIframeLoaded(false);
  }, []);

  const switchProvider = useCallback(() => {
    if (currentIdx < providers.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setCurrentIdx(0);
    }
  }, [currentIdx, providers.length]);

  // Auto-switch to next provider on error
  useEffect(() => {
    if (!iframeError || !providers.length) return;
    const timer = setTimeout(() => {
      if (currentIdx < providers.length - 1) {
        switchProvider();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [iframeError, currentIdx, providers.length, switchProvider]);

  if (!playerMedia) return null;

  const iframeUrl = currentProvider?.url;
  const isTV = playerMedia.type === "tv" && detail?.seasons;

  return (
    <Dialog
      open={!!playerMedia}
      onOpenChange={(open) => {
        if (!open) closePlayer();
      }}
    >
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-black p-0 sm:rounded-none md:h-[90vh] md:max-h-[90vh] md:w-[95vw] md:max-w-5xl md:rounded-xl"
      >
        <DialogTitle className="sr-only">{playerMedia.title} Player</DialogTitle>

        {/* Top bar - fixed height, not absolute */}
        <div className="flex shrink-0 items-center justify-between gap-2 bg-black px-3 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xs font-semibold text-white sm:text-sm md:text-base">
              {playerMedia.title}
            </h2>
            <p className="truncate text-[10px] text-white/60 sm:text-xs">
              {playerMedia.type === "tv"
                ? `Season ${season} • Episode ${episode}`
                : "Now Playing"}
            </p>
          </div>

          {providers.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Select
                value={String(currentIdx)}
                onValueChange={(v) => setCurrentIdx(parseInt(v, 10))}
              >
                <SelectTrigger className="h-7 w-24 gap-1 border-white/20 bg-white/10 text-[10px] text-white backdrop-blur-sm sm:h-8 sm:w-32 sm:text-xs md:w-40">
                  <Server className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p, idx) => (
                    <SelectItem key={p.name} value={String(idx)}>
                      <span className="flex items-center gap-2">
                        {p.name}
                        <Badge
                          variant="outline"
                          className={cn(
                            "ml-1 px-1 text-[8px] sm:text-[9px]",
                            p.brutality === 0
                              ? "border-green-500/40 text-green-400"
                              : p.brutality <= 2
                                ? "border-yellow-500/40 text-yellow-400"
                                : "border-red-500/40 text-red-400",
                          )}
                        >
                          {p.brutality === 0
                            ? "Clean"
                            : p.brutality <= 2
                              ? "Low"
                              : p.brutality <= 4
                                ? "Med"
                                : "High"}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                onClick={() => closePlayer()}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary sm:h-9 sm:w-9"
                aria-label="Close player"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Player area - flex-1 to fill remaining space */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading stream...</p>
            </div>
          )}

          {!loading && iframeUrl && (
            <>
              <iframe
                key={iframeUrl}
                src={iframeUrl}
                className={cn(
                  "h-full w-full transition-opacity duration-500",
                  iframeLoaded ? "opacity-100" : "opacity-0",
                )}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={() => setIframeLoaded(true)}
                onError={handleIframeError}
                title={`${playerMedia.title} Player`}
              />

              {!iframeLoaded && !iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-white/70">
                    Loading from {currentProvider?.name}...
                  </p>
                </div>
              )}

              {iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <div>
                    <p className="mb-1 text-base font-semibold">
                      Playback Error
                    </p>
                    <p className="text-sm text-white/60">
                      {currentProvider?.name} couldn&apos;t load this title.
                      Try another server.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={switchProvider}
                      size="sm"
                      className="gap-2"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Try Next Server
                    </Button>
                    <Button
                      onClick={() => {
                        setIframeError(false);
                        setIframeLoaded(false);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Retry
                    </Button>
                  </div>
                  <p className="text-xs text-white/40">
                    Server {currentIdx + 1} of {providers.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom controls for TV shows - fixed height, not absolute */}
        {isTV && (
          <div className="flex shrink-0 items-center gap-2 bg-black px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
            <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
              <SelectTrigger className="h-7 w-20 border-white/20 bg-white/10 text-[10px] text-white backdrop-blur-sm sm:h-8 sm:w-24 sm:text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {detail.seasons
                  .filter((s) => s.season_number > 0)
                  .map((s) => (
                    <SelectItem key={s.id} value={String(s.season_number)}>
                      Season {s.season_number}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={String(episode)} onValueChange={(v) => setEpisode(parseInt(v, 10))}>
              <SelectTrigger className="h-7 w-24 border-white/20 bg-white/10 text-[10px] text-white backdrop-blur-sm sm:h-8 sm:w-28 sm:text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {Array.from({ length: 20 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    Episode {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/10 sm:h-8 sm:w-8"
                disabled={episode <= 1}
                onClick={() => setEpisode(Math.max(1, episode - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/10 sm:h-8 sm:w-8"
                onClick={() => setEpisode(episode + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
