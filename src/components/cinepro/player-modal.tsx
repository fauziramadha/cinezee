"use client";

import { useEffect, useState, useCallback } from "react";
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

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [season, setSeason] = useState(playerSeason || 1);
  const [episode, setEpisode] = useState(playerEpisode || 1);

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

    // Use a single async function to avoid synchronous setState in effect body
    const loadProviders = async () => {
      // Defer state resets to avoid synchronous setState in effect
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
      } catch {
        if (cancelled) return;
        setLoading(false);
        setIframeError(true);
      }
    };

    loadProviders();

    // Also fetch detail for TV seasons/episodes (fire-and-forget)
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
  }, [playerMedia, season, episode]);

  // Reset iframe state when provider changes (using a deferred update)
  useEffect(() => {
    if (currentIdx === 0 && providers.length === 0) return; // skip initial mount
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

  // Auto-switch to next provider on error (after 8s timeout)
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

  return (
    <Dialog
      open={!!playerMedia}
      onOpenChange={(open) => {
        if (!open) closePlayer();
      }}
    >
      <DialogContent
        className="max-h-[100vh] max-w-[100vw] gap-0 overflow-hidden p-0 sm:max-w-5xl sm:rounded-xl"
        style={{ height: "100vh" }}
      >
        <DialogTitle className="sr-only">{playerMedia.title} Player</DialogTitle>

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/90 to-transparent px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white sm:text-base">
              {playerMedia.title}
            </h2>
            <p className="truncate text-xs text-white/60">
              {playerMedia.type === "tv"
                ? `Season ${season} • Episode ${episode}`
                : "Now Playing"}
            </p>
          </div>

          {/* Provider switcher */}
          {providers.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={String(currentIdx)}
                onValueChange={(v) => setCurrentIdx(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 w-32 gap-1 border-white/20 bg-black/60 text-xs text-white backdrop-blur-sm sm:w-40">
                  <Server className="h-3.5 w-3.5" />
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
                            "ml-1 px-1 text-[9px]",
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
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-primary"
                aria-label="Close player"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Player area */}
        <div className="relative h-full w-full bg-black">
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

              {/* Loading overlay before iframe loads */}
              {!iframeLoaded && !iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-white/70">
                    Loading from {currentProvider?.name}...
                  </p>
                </div>
              )}

              {/* Error overlay */}
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

        {/* Bottom controls for TV shows */}
        {playerMedia.type === "tv" && detail?.seasons && (
          <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center gap-3 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 sm:px-6">
            <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
              <SelectTrigger className="h-8 w-24 border-white/20 bg-black/60 text-xs text-white backdrop-blur-sm">
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
              <SelectTrigger className="h-8 w-28 border-white/20 bg-black/60 text-xs text-white backdrop-blur-sm">
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
                className="h-8 w-8 text-white hover:bg-white/10"
                disabled={episode <= 1}
                onClick={() => setEpisode(Math.max(1, episode - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/10"
                onClick={() => setEpisode(episode + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
