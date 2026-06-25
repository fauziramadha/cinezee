"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Server,
  RotateCcw,
  Maximize,
  Minimize,
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
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  // For auto-hide controls in pseudo-fullscreen
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================
  // BUG FIX 2: Track previous media id so we ONLY reset currentIdx
  // when the actual movie/show changes — NOT when NextAuth refreshes
  // the session token (which was causing the server selector to
  // jump back to Server 1 every minute).
  // ============================================================
  const prevMediaKey = useRef<string>("");

  // KEY FIX: Sync local state when playerSeason/playerEpisode changes in store
  useEffect(() => {
    setSeason(playerSeason || 1);
    setEpisode(playerEpisode || 1);
  }, [playerSeason, playerEpisode]);

  // Handle Escape key for Pseudo-Fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPseudoFullscreen) {
        e.preventDefault();
        e.stopPropagation();
        setIsPseudoFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [isPseudoFullscreen]);

  // Cleanup hide timeout
  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  // Auto-hide controls in pseudo-fullscreen
  const handleMouseMove = useCallback(() => {
    if (!isPseudoFullscreen) return;
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [isPseudoFullscreen]);

  // Reset showControls when toggling fullscreen
  useEffect(() => {
    setShowControls(true);
  }, [isPseudoFullscreen]);

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
      console.error("[SAVE HISTORY ERROR]", error);
    }
  }, [playerMedia, session, status, season, episode]);

  // ============================================================
  // BUG FIX 2 (continued): Only reset currentIdx when media
  // actually changes. Use a ref to track previous media key.
  // ============================================================
  useEffect(() => {
    if (!playerMedia) return;

    const mediaKey = `${playerMedia.id}-${playerMedia.type}`;
    const isMediaChanged = mediaKey !== prevMediaKey.current;
    prevMediaKey.current = mediaKey;

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
      // ONLY reset to Server 1 if the movie/show itself changed.
      // If only season/episode changed, keep the user's server choice.
      if (isMediaChanged) {
        setCurrentIdx(0);
      }

      try {
        const res = await fetch(`/api/providers?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setProviders(data.providers || []);
        setLoading(false);
        saveToHistory();
        trackPlay(playerMedia.id, playerMedia.type, playerMedia.title);
      } catch {
        if (cancelled) return;
        setLoading(false);
        setIframeError(true);
      }
    };

    loadProviders();

    // Only re-fetch detail when media actually changes (not on season/episode change)
    if (isMediaChanged) {
      fetch(`/api/detail/${playerMedia.id}?type=${playerMedia.type}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setDetail(data);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMedia, season, episode]);

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
  const isFilmU = currentProvider?.url.includes("embed.filmu.in");

  // ============================================================
  // BUG FIX 1: Use !important Tailwind classes to KILL shadcn's
  // default `left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2`.
  // Inline `transform: none` alone is NOT enough because Tailwind's
  // translate classes set CSS variables that combine into transform.
  // We MUST use `!translate-x-0 !translate-y-0` to nuke them.
  // ============================================================

  // Inline styles for flex centering + opaque background
  const dialogContentStyle: React.CSSProperties = isPseudoFullscreen
    ? {
        position: "fixed",
        zIndex: 99999,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        backgroundColor: "#000",
        padding: "0",
        margin: "0",
      }
    : {
        position: "fixed",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Fully opaque backdrop so underlying app isn't visible
        backgroundColor: "rgba(0,0,0,1)",
        // Safe area padding for iPhones with notch
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      };

  // Controls visibility (auto-hide in pseudo-fullscreen)
  const controlsVisible = !isPseudoFullscreen || showControls || iframeError;

  return (
    <Dialog
      open={!!playerMedia}
      onOpenChange={(open) => {
        if (!open) {
          setIsPseudoFullscreen(false);
          closePlayer();
        }
      }}
    >
      <DialogContent
        style={dialogContentStyle}
        className={cn(
          // === CRITICAL: Kill shadcn default positioning ===
          // shadcn DialogContent adds: left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]
          // These !important classes override those defaults.
          "!left-0 !top-0",
          "!translate-x-0 !translate-y-0",
          // Full viewport
          "!w-screen !h-screen",
          "!max-w-none !max-h-none !min-w-0 !min-h-0",
          // Cosmetic cleanup
          "!p-0 !border-0 !bg-transparent !shadow-none !gap-0 !rounded-none"
        )}
        onMouseMove={handleMouseMove}
        onEscapeKeyDown={(e) => {
          if (isPseudoFullscreen) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{playerMedia.title} Player</DialogTitle>

        {/* ============================================================ */}
        {/* INNER PLAYER BOX                                              */}
        {/* In pseudo-fullscreen: fills entire viewport                  */}
        {/* In normal mode: 95vw x 85vh, max 1100px, rounded corners     */}
        {/* ============================================================ */}
        <div
          style={
            isPseudoFullscreen
              ? {
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  margin: "0",
                  borderRadius: "0",
                  backgroundColor: "#000",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
              : {
                  position: "relative",
                  width: "95vw",
                  maxWidth: "1100px",
                  height: "85vh",
                  maxHeight: "700px",
                  margin: "0",
                  borderRadius: "12px",
                  backgroundColor: "#000",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
                }
          }
        >
          {/* Top bar - Auto hide on Pseudo Fullscreen */}
          <div
            className={cn(
              "absolute left-0 right-0 top-0 z-30 flex shrink-0 items-center justify-between gap-2 bg-gradient-to-b from-black/90 to-transparent px-3 py-2 transition-opacity duration-300 sm:px-4 sm:py-3",
              controlsVisible ? "opacity-100" : "opacity-0"
            )}
          >
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
                {/* Pseudo-Fullscreen Button (Only for FilmU) */}
                {isFilmU && iframeLoaded && !iframeError && (
                  <button
                    onClick={() => setIsPseudoFullscreen(!isPseudoFullscreen)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary sm:h-9 sm:w-9"
                    aria-label={isPseudoFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isPseudoFullscreen ? <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  </button>
                )}

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
                  onClick={() => {
                    setIsPseudoFullscreen(false);
                    closePlayer();
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary sm:h-9 sm:w-9"
                  aria-label="Close player"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Player area */}
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
                    iframeLoaded ? "opacity-100" : "opacity-0"
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

          {/* Bottom controls for TV shows - Auto hide on Pseudo Fullscreen */}
          {isTV && (
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 z-30 flex shrink-0 items-center gap-2 bg-gradient-to-t from-black/90 to-transparent px-3 py-2 transition-opacity duration-300 sm:gap-3 sm:px-4 sm:py-3",
                controlsVisible ? "opacity-100" : "opacity-0"
              )}
            >
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
