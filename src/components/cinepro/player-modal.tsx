"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSafeSession } from "@/lib/use-safe-session";
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
  Crown,
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
import { PreRollAd } from "@/components/ads/pre-roll-ad";

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
  const { data: session, status } = useSafeSession();

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [season, setSeason] = useState(playerSeason || 1);
  const [episode, setEpisode] = useState(playerEpisode || 1);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevMediaKey = useRef<string>("");
  const [showPreRoll, setShowPreRoll] = useState(false);
  const [adConfig, setAdConfig] = useState<{
    preroll_url: string;
    duration: number;
    skip_delay: number;
  } | null>(null);

  // === FILMBOX PREMIUM PROVIDER ===
  const [filmboxMatch, setFilmboxMatch] = useState<{
    detailPath: string;
    subjectId: string;
    title: string;
  } | null>(null);
  const [filmboxStream, setFilmboxStream] = useState<string>("");
  const [filmboxSubtitle, setFilmboxSubtitle] = useState<string>("");
  const [filmboxLoading, setFilmboxLoading] = useState(false);
  const [filmboxSearching, setFilmboxSearching] = useState(false);
  const [isFilmboxProvider, setIsFilmboxProvider] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSeason(playerSeason || 1);
    setEpisode(playerEpisode || 1);
  }, [playerSeason, playerEpisode]);

  useEffect(() => {
    if (playerMedia) {
      fetch("/api/ads/config")
        .then((res) => res.json())
        .then((data) => {
          if (data.hilltopads?.preroll_url) {
            setAdConfig(data.hilltopads);
            setShowPreRoll(true);
          }
        })
        .catch(() => {});
    } else {
      setShowPreRoll(false);
      setAdConfig(null);
    }
  }, [playerMedia]);

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

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

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

  useEffect(() => {
    setShowControls(true);
  }, [isPseudoFullscreen]);

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
      if (isMediaChanged) {
        setCurrentIdx(0);
        setIsFilmboxProvider(false);
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

  // === SEARCH FILMBOX BY TITLE (matching TMDB) ===
  // subjectType: 1 = movie, 2 = drama/series (Filmbox format)
  useEffect(() => {
    if (!playerMedia) return;

    let cancelled = false;
    setFilmboxSearching(true);
    setFilmboxMatch(null);
    setFilmboxStream("");
    setFilmboxSubtitle("");
    setIsFilmboxProvider(false);

    const searchFilmbox = async () => {
      try {
        // Determine subjectType: 1 for movie, 2 for tv
        const subjectType = playerMedia.type === "tv" ? 2 : 1;

        const res = await fetch("/api/filmbox/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: playerMedia.title,
            page: 0,
            perPage: 10,
            subjectType: subjectType,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        // Parse response - shape: { code, message, data: { items: [...] } }
        const inner = data?.data || data;
        const items = inner?.items || inner?.list || [];

        if (items.length === 0) {
          setFilmboxSearching(false);
          return;
        }

        // Normalize title for matching
        const normalizeTitle = (t: string) =>
          t.toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const tmdbTitle = normalizeTitle(playerMedia.title);

        // Get year from detail if available (for better matching)
        const tmdbYear = detail?.release_date || detail?.first_air_date || "";
        const tmdbYearStr = tmdbYear ? tmdbYear.split("-")[0] : "";

        // Find best match: exact title match first, then contains match
        let bestMatch = null;
        let bestScore = 0;

        for (const item of items) {
          const itemTitle = normalizeTitle(item.title || item.name || "");
          if (!itemTitle) continue;

          let score = 0;

          // Exact match = highest score
          if (itemTitle === tmdbTitle) {
            score = 100;
          }
          // TMDB title contains item title
          else if (tmdbTitle.includes(itemTitle)) {
            score = 80;
          }
          // Item title contains TMDB title
          else if (itemTitle.includes(tmdbTitle)) {
            score = 70;
          }

          // Bonus: year match
          if (score > 0 && tmdbYearStr) {
            const itemYear = (item.releaseDate || "").split("-")[0];
            if (itemYear === tmdbYearStr) {
              score += 10;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }

        if (bestMatch && bestScore >= 70 && !cancelled) {
          setFilmboxMatch({
            detailPath: bestMatch.detailPath || bestMatch.detail_path || "",
            subjectId: String(bestMatch.subjectId || bestMatch.subject_id || bestMatch.id || ""),
            title: bestMatch.title || bestMatch.name || "",
          });
        }
      } catch (err) {
        console.error("[Filmbox search] error:", err);
      } finally {
        if (!cancelled) setFilmboxSearching(false);
      }
    };

    searchFilmbox();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMedia, detail]);

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

  // === LOAD FILMBOX STREAM URL ===
  const loadFilmboxStream = useCallback(async () => {
    if (!filmboxMatch) return;

    setFilmboxLoading(true);
    setFilmboxStream("");
    setFilmboxSubtitle("");
    setIframeError(false);
    setIframeLoaded(false);

    try {
      const params = new URLSearchParams({
        subjectId: filmboxMatch.subjectId,
        detailPath: filmboxMatch.detailPath,
        se: "0",
        ep: "0",
        lang: "in_id",
      });

      const res = await fetch(`/api/filmbox/getplay?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch stream");

      const data = await res.json();

      const playData = data?.data || data;

      // Get video URL - prefer vid_url, then hls 720p
      let rawStreamUrl = playData?.vid_url || "";

      if (!rawStreamUrl && Array.isArray(playData?.hls)) {
        const hls720 = playData.hls.find((h: any) => h.resolutions === "720");
        rawStreamUrl = hls720?.url || playData.hls[playData.hls.length - 1]?.url || "";
      }

      // Get subtitle Indonesia
      let rawSubtitleUrl = "";
      if (Array.isArray(playData?.subtitles)) {
        const subIndo = playData.subtitles.find((s: any) => s.id === "in_id" || s.label === "in_id");
        rawSubtitleUrl = subIndo?.url || "";
      }
      if (!rawSubtitleUrl) {
        rawSubtitleUrl = playData?.sub_url || "";
      }

      if (rawStreamUrl) {
        // Pakai proxy route kita sendiri untuk handle CORS + token
        const streamUrl = `/api/filmbox/stream?url=${encodeURIComponent(rawStreamUrl)}`;
        setFilmboxStream(streamUrl);

        if (rawSubtitleUrl) {
          // Subtitle juga pakai proxy
          const subtitleUrl = `/api/filmbox/stream?url=${encodeURIComponent(rawSubtitleUrl)}`;
          setFilmboxSubtitle(subtitleUrl);
        }
      } else {
        setIframeError(true);
      }
    } catch (err) {
      console.error("[Filmbox getplay] error:", err);
      setIframeError(true);
    } finally {
      setFilmboxLoading(false);
    }
  }, [filmboxMatch]);

  // === SETUP VIDEO (untuk Filmbox Premium - MP4 format) ===
  useEffect(() => {
    if (!isFilmboxProvider || !filmboxStream) return;

    const video = videoRef.current;
    if (!video) return;

    setIframeLoaded(false);
    setIframeError(false);

    // MP4 format - langsung set src, tidak perlu hls.js
    video.src = filmboxStream;
    video.load();

    const onLoaded = () => {
      setIframeLoaded(true);
      video.play().catch(() => {});
    };
    const onError = () => {
      setIframeError(true);
      setIframeLoaded(false);
    };

    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      video.src = "";
    };
  }, [isFilmboxProvider, filmboxStream]);

  // === AUTO FAILOVER: Filmbox error → switch ke Server 1 ===
  useEffect(() => {
    if (!isFilmboxProvider || !iframeError) return;

    const timer = setTimeout(() => {
      // Switch ke Server 1 (currentIdx = 0, isFilmboxProvider = false)
      setIsFilmboxProvider(false);
      setFilmboxStream("");
      setIframeError(false);
      setIframeLoaded(false);
      setCurrentIdx(0);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isFilmboxProvider, iframeError]);

  if (!playerMedia) return null;

  const iframeUrl = currentProvider?.url;
  const isTV = playerMedia.type === "tv" && detail?.seasons;
  const isFilmU = currentProvider?.url.includes("embed.filmu.in");
  const isVidking = currentProvider?.url.includes("vidking.net");

  const showBottomControls = isTV && isVidking;

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
        backgroundColor: "rgba(0,0,0,1)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      };

  const controlsVisible = !isPseudoFullscreen || showControls || iframeError;

  const showProviderSelector = providers.length > 0 || filmboxMatch || filmboxSearching;

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
          "!left-0 !top-0",
          "!translate-x-0 !translate-y-0",
          "!w-screen !h-[100dvh]",
          "!max-w-none !max-h-none !min-w-0 !min-h-0",
          "!p-0 !border-0 !bg-transparent !shadow-none !gap-0 !rounded-none"
        )}
        onMouseMove={handleMouseMove}
        onEscapeKeyDown={(e) => {
          if (isPseudoFullscreen) e.preventDefault();
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{playerMedia.title} Player</DialogTitle>

        <div
          data-player-modal="true"
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
                  height: "calc(100dvh - 1.5rem)",
                  maxHeight: "calc(100dvh - 1.5rem)",
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
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 bg-gradient-to-b from-black/90 to-black/40 px-3 py-2 transition-opacity duration-300 sm:px-4 sm:py-3",
              isPseudoFullscreen && "absolute left-0 right-0 top-0 z-30",
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xs font-semibold text-white sm:text-sm md:text-base">
                {playerMedia.title}
              </h2>
              <p className="truncate text-[10px] text-white/60 sm:text-xs">
                {playerMedia.type === "tv"
                  ? `Season ${season} - Episode ${episode}`
                  : "Now Playing"}
              </p>
            </div>

            {showProviderSelector && (
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {((isFilmU && iframeLoaded && !iframeError) || (isFilmboxProvider && iframeLoaded && !iframeError)) && (
                  <button
                    onClick={() => setIsPseudoFullscreen(!isPseudoFullscreen)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary sm:h-9 sm:w-9"
                    aria-label={isPseudoFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isPseudoFullscreen ? <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  </button>
                )}

                <Select
                  value={isFilmboxProvider ? "filmbox" : String(currentIdx)}
                  onValueChange={(v) => {
                    if (v === "filmbox") {
                      setIsFilmboxProvider(true);
                      setIframeError(false);
                      setIframeLoaded(false);
                      if (!filmboxStream) {
                        loadFilmboxStream();
                      }
                    } else {
                      setIsFilmboxProvider(false);
                      setFilmboxStream("");
                      setCurrentIdx(parseInt(v, 10));
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-24 shrink-0 gap-1 border-white/20 bg-white/10 text-[10px] text-white backdrop-blur-sm sm:h-8 sm:w-32 sm:text-xs md:w-40">
                    {isFilmboxProvider ? (
                      <Crown className="h-3 w-3 shrink-0 text-yellow-400 sm:h-3.5 sm:w-3.5" />
                    ) : (
                      <Server className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                    )}
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filmboxMatch && !filmboxSearching && (
                      <SelectItem value="filmbox">
                        <span className="flex items-center gap-2">
                          <Crown className="h-3 w-3 text-yellow-400" />
                          <span className="font-semibold">Premium</span>
                          <Badge variant="outline" className="ml-1 border-yellow-500/40 px-1 text-[8px] text-yellow-400">
                            HD
                          </Badge>
                        </span>
                      </SelectItem>
                    )}
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

          <div className="relative flex-1 overflow-hidden bg-black">
            {showPreRoll && adConfig && (
              <PreRollAd
                config={adConfig}
                onComplete={() => setShowPreRoll(false)}
              />
            )}

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-white/70">Loading stream...</p>
              </div>
            )}

            {/* === FILMBOX PREMIUM: pakai video tag (MP4) === */}
            {isFilmboxProvider && filmboxStream && (
              <>
                <video
                  ref={videoRef}
                  className={cn(
                    "h-full w-full transition-opacity duration-500",
                    iframeLoaded ? "opacity-100" : "opacity-0"
                  )}
                  controls
                  playsInline
                  crossOrigin="anonymous"
                  onError={() => {
                    setIframeError(true);
                    setIframeLoaded(false);
                  }}
                >
                  {filmboxSubtitle && (
                    <track
                      kind="subtitles"
                      srcLang="id"
                      label="Indonesia"
                      src={filmboxSubtitle}
                      default
                    />
                  )}
                </video>

                {!iframeLoaded && !iframeError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-white/70">
                      Loading from Premium (Filmbox)...
                    </p>
                  </div>
                )}

                {iframeError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                    <div>
                      <p className="mb-1 text-base font-semibold">Premium Error</p>
                      <p className="text-sm text-white/60">
                        Mengalihkan ke Server 1...
                      </p>
                    </div>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </>
            )}

            {/* === REGULAR PROVIDERS: pakai iframe === */}
            {!isFilmboxProvider && !loading && iframeUrl && (
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
                      <p className="mb-1 text-base font-semibold">Playback Error</p>
                      <p className="text-sm text-white/60">
                        {currentProvider?.name} couldn&apos;t load this title.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={switchProvider} size="sm" className="gap-2">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Try Next Server
                      </Button>
                      <Button
                        onClick={() => { setIframeError(false); setIframeLoaded(false); }}
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

            {/* === FILMBOX LOADING (saat fetch stream URL) === */}
            {isFilmboxProvider && filmboxLoading && !filmboxStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-white/70">Mencari film di Premium...</p>
              </div>
            )}
          </div>

          {showBottomControls && (
            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-2 bg-gradient-to-t from-black/95 to-black/70 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transition-opacity duration-300 sm:px-4",
                isPseudoFullscreen && "absolute bottom-0 left-0 right-0 z-30 pt-8",
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <div className="flex shrink-0 items-center gap-2">
                <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
                  <SelectTrigger className="h-9 w-20 shrink-0 border-white/20 bg-white/10 text-xs text-white backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.seasons
                      .filter((s) => s.season_number > 0)
                      .map((s) => (
                        <SelectItem key={s.id} value={String(s.season_number)}>
                          S{s.season_number}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={String(episode)} onValueChange={(v) => setEpisode(parseInt(v, 10))}>
                  <SelectTrigger className="h-9 w-24 shrink-0 border-white/20 bg-white/10 text-xs text-white backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        EP {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-white hover:bg-white/20"
                  disabled={episode <= 1}
                  onClick={() => setEpisode(Math.max(1, episode - 1))}
                  aria-label="Previous episode"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-white hover:bg-white/20"
                  onClick={() => setEpisode(episode + 1)}
                  aria-label="Next episode"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
