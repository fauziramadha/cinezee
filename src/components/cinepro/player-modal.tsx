"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  X,
  AlertCircle,
  Loader2,
  Maximize,
  Minimize,
  Subtitles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { getStreamProxyUrl, fetchCinemacityPlay } from "@/lib/cinemacity-api";
import { cn } from "@/lib/utils";

interface Subtitle {
  label: string;
  url: string;
  language: string;
  type: "full" | "sdh" | "forced";
}

// Dynamically load HLS.js from CDN
let hlsPromise: Promise<any> | null = null;
async function loadHls(): Promise<any> {
  if (typeof window === "undefined") return null;
  if ((window as any).Hls) return (window as any).Hls;

  if (!hlsPromise) {
    hlsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      script.async = true;
      script.onload = () => resolve((window as any).Hls);
      script.onerror = () => reject(new Error("Failed to load HLS.js"));
      document.head.appendChild(script);
    });
  }
  return hlsPromise;
}

export function PlayerModal() {
  const { playerMedia, closePlayer, addToHistory } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [showSubtitlesMenu, setShowSubtitles] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsPseudoFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch stream URL when player opens
  useEffect(() => {
    if (!playerMedia) {
      setStreamUrl("");
      setSubtitles([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadStream = async () => {
      try {
        // Only cinemacity source supported
        if (playerMedia.source !== "cinemacity" || !playerMedia.slug) {
          throw new Error("Player only supports cinemacity source. Selected media has no slug.");
        }

        const data = await fetchCinemacityPlay(playerMedia.slug);

        if (cancelled) return;

        if (!data.streamUrl) {
          throw new Error("Stream URL not found for this content.");
        }

        setStreamUrl(data.streamUrl);
        setSubtitles(data.subtitles || []);
        setCurrentSubtitle("");

        // Add to history
        addToHistory({
          ...playerMedia,
          watchedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load stream");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStream();

    return () => {
      cancelled = true;
      // Cleanup HLS
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerMedia]);

  // Initialize video player when streamUrl changes
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    const proxyUrl = getStreamProxyUrl(streamUrl);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const initPlayer = async () => {
      // Check if native HLS is supported (Safari, iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = proxyUrl;
        return;
      }

      // Use HLS.js for other browsers
      try {
        const Hls = await loadHls();
        if (!Hls) {
          video.src = proxyUrl;
          return;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsRef.current = hls;

        hls.loadSource(proxyUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError("Stream playback error. Please try again.");
                hls.destroy();
                break;
            }
          }
        });
      } catch (err) {
        setError("Failed to load video player");
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  // Handle subtitle selection
  const handleSubtitleChange = useCallback((url: string) => {
    setCurrentSubtitle(url);
    setShowSubtitlesMenu(false);

    const video = videoRef.current;
    if (!video) return;

    // Remove existing text tracks
    const tracks = video.textTracks;
    for (let i = tracks.length - 1; i >= 0; i--) {
      video.removeChild(tracks[i]);
    }

    if (url) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = subtitles.find((s) => s.url === url)?.label || "Subtitles";
      track.srclang = "en";
      track.src = getStreamProxyUrl(url);
      track.default = true;
      video.appendChild(track);

      // Enable the track
      setTimeout(() => {
        const lastTrack = video.textTracks[video.textTracks.length - 1];
        if (lastTrack) {
          lastTrack.mode = "showing";
        }
      }, 100);
    }
  }, [subtitles]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen();
    }
  }, []);

  if (!playerMedia) return null;

  return (
    <Dialog open={!!playerMedia} onOpenChange={(open) => !open && closePlayer()}>
      <DialogContent className="max-w-[95vw] overflow-hidden rounded-xl border-0 bg-black p-0 md:max-w-5xl">
        <DialogTitle className="sr-only">{playerMedia.title}</DialogTitle>

        {/* Close button */}
        <button
          onClick={closePlayer}
          className={cn(
            "absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-opacity hover:bg-red-600",
            showControls ? "opacity-100" : "opacity-0",
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex aspect-video items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading stream...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm text-white/90">{error}</p>
            <Button variant="secondary" size="sm" onClick={closePlayer}>
              Close
            </Button>
          </div>
        )}

        {/* Video player */}
        {!loading && !error && streamUrl && (
          <div
            ref={containerRef}
            className="relative aspect-video w-full bg-black"
            onMouseMove={showControlsTemporarily}
            onClick={showControlsTemporarily}
          >
            <video
              ref={videoRef}
              className="h-full w-full"
              controls
              playsInline
              autoPlay
            />

            {/* Title bar */}
            <div
              className={cn(
                "absolute left-0 right-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity",
                showControls ? "opacity-100" : "opacity-0",
              )}
            >
              <h3 className="text-sm font-semibold text-white md:text-base">
                {playerMedia.title}
              </h3>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {playerMedia.type === "tv" ? "TV Series" : "Movie"}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-white/70">
                  cinemacity.cc
                </Badge>
              </div>
            </div>

            {/* Bottom controls */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity",
                showControls ? "opacity-100" : "opacity-0",
              )}
            >
              {/* Subtitles button */}
              {subtitles.length > 0 && (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-white hover:bg-white/20"
                    onClick={() => setShowSubtitlesMenu(!showSubtitlesMenu)}
                  >
                    <Subtitles className="h-4 w-4" />
                    <span className="text-xs">CC</span>
                  </Button>

                  {showSubtitlesMenu && (
                    <div className="absolute bottom-12 left-0 max-h-60 w-56 overflow-y-auto rounded-lg border border-border bg-black/95 p-2 shadow-xl backdrop-blur-md">
                      <button
                        onClick={() => handleSubtitleChange("")}
                        className={cn(
                          "block w-full rounded px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10",
                          !currentSubtitle && "bg-primary/20 text-white",
                        )}
                      >
                        Off
                      </button>
                      {subtitles.map((sub) => (
                        <button
                          key={sub.url}
                          onClick={() => handleSubtitleChange(sub.url)}
                          className={cn(
                            "block w-full rounded px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10",
                            currentSubtitle === sub.url && "bg-primary/20 text-white",
                          )}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen button */}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                {isPseudoFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
