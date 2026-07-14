"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { X, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { getStreamProxyUrl, fetchCinemacityPlay } from "@/lib/cinemacity-api";
import { cn } from "@/lib/utils";

interface Subtitle {
  label: string;
  url: string;
  language: string;
  type: "full" | "sdh" | "forced";
}

interface StreamEpisode {
  title: string;
  streamUrl: string;
  subtitles?: Subtitle[];
  season?: string;
  episode?: string;
}

// ============================================================
// HLS.js Loader — cache busting untuk m3u8 URLs
// (mimic cinemacity's original CustomLoader)
// ============================================================
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

function makeCustomLoader(Hls: any) {
  return class CustomLoader extends Hls.DefaultConfig.loader {
    load(context: any, config: any, callbacks: any) {
      const onSuccess = callbacks.onSuccess;
      callbacks.onSuccess = (response: any, stats: any, ctx: any, details: any) => {
        // Cache busting: add ?RANDOM ke setiap .m3u8 URL di playlist
        if (typeof response.data === "string") {
          response.data = response.data.replace(
            /\.(m3u8)\b/g,
            (match: string) => `${match}?${Math.floor(Math.random() * 1e9)}`
          );
        }
        if (onSuccess) onSuccess.call(this, response, stats, ctx, details);
      };
      return super.load(context, config, callbacks);
    }
  };
}

export function PlayerModal() {
  const { playerMedia, closePlayer, addToHistory } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [episodes, setEpisodes] = useState<StreamEpisode[]>([]);
  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentEpisodeIdx, setCurrentEpisodeIdx] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const currentStreamUrlRef = useRef<string>("");
  const playerMediaRef = useRef(playerMedia);

  // Keep playerMediaRef in sync
  useEffect(() => {
    playerMediaRef.current = playerMedia;
  }, [playerMedia]);

  // ============================================================
  // DERIVED: seasons list + current season episodes
  // ============================================================
  const seasons = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((e) => set.add(e.season || "1"));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [episodes]);

  const currentSeasonEpisodes = useMemo(() => {
    return episodes.filter((e) => (e.season || "1") === currentSeason);
  }, [episodes, currentSeason]);

  // ============================================================
  // CHANGE STREAM SOURCE (no re-mount)
  // Pakai hls.loadSource() untuk HLS.js, video.src untuk native
  // ============================================================
  const changeStreamSource = useCallback((newUrl: string) => {
    const video = videoRef.current;
    if (!video || !newUrl) return;

    currentStreamUrlRef.current = newUrl;
    setStreamUrl(newUrl);

    // Native HLS (iOS Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl") && !hlsRef.current) {
      video.src = newUrl;
      video.play().catch(() => {});
      return;
    }

    // HLS.js: langsung loadSource (gak destroy + re-create)
    if (hlsRef.current) {
      hlsRef.current.loadSource(newUrl);
    }
  }, []);

  // ============================================================
  // INIT HLS PLAYER (sekali saja, saat pertama buka)
  // ============================================================
  const initHlsPlayer = useCallback(async (url: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Native HLS (Safari, iOS) — gak perlu HLS.js
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      const Hls = await loadHls();
      if (!Hls) {
        video.src = url;
        return;
      }

      const hls = new Hls({
        // ============================================================
        // PERFORMANCE & STABILITY TUNING
        // ============================================================
        enableWorker: true,
        lowLatencyMode: false,
        // Buffer tuning — larger buffer = smoother seek
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1024 * 1024, // 60MB
        backBufferLength: 30,
        // Retry tuning — lebih aggressive saat network error
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 8000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 500,
        // Custom loader untuk cache busting (mimic cinemacity)
        loader: makeCustomLoader(Hls),
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      // ============================================================
      // ERROR RECOVERY — auto-retry saat fatal error
      // ============================================================
      hls.on(Hls.Events.ERROR, async (_event: any, data: any) => {
        if (!data.fatal) return;

        const currentMedia = playerMediaRef.current;
        console.warn("[HLS FATAL ERROR]", data.type, data.details);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Retry network error
            console.log("[HLS] Network error, retrying...");
            hls.startLoad();
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            // Retry media error
            console.log("[HLS] Media error, recovering...");
            hls.recoverMediaError();
            break;

          default:
            // Fatal error (maybe token expired) — refresh stream URL
            if (currentMedia?.source === "cinemacity" && currentMedia?.slug && retryCount < 3) {
              console.log(`[HLS] Fatal error, refreshing stream URL (retry ${retryCount + 1}/3)...`);
              setRetryCount((c) => c + 1);
              try {
                const freshData = await fetchCinemacityPlay(currentMedia.slug);
                if (freshData.streamUrl) {
                  changeStreamSource(freshData.streamUrl);
                  setSubtitles(freshData.subtitles || []);
                }
              } catch (refreshErr) {
                console.error("[HLS] Refresh failed:", refreshErr);
                setError("Stream error. Please try again.");
                hls.destroy();
              }
            } else {
              setError("Stream playback error. Please try again.");
              hls.destroy();
            }
            break;
        }
      });
    } catch (err) {
      console.error("[HLS Init Error]", err);
      setError("Failed to load video player");
    }
  }, [changeStreamSource, retryCount]);

  // ============================================================
  // FETCH STREAM URL when player opens
  // ============================================================
  useEffect(() => {
    if (!playerMedia) {
      setStreamUrl("");
      setSubtitles([]);
      setEpisodes([]);
      setError(null);
      setRetryCount(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRetryCount(0);

    const loadStream = async () => {
      try {
        if (playerMedia.source !== "cinemacity" || !playerMedia.slug) {
          throw new Error("Player only supports cinemacity source.");
        }

        const data = await fetchCinemacityPlay(playerMedia.slug);

        if (cancelled) return;

        if (!data.streamUrl) {
          throw new Error("Stream URL not found for this content.");
        }

        setStreamUrl(data.streamUrl);
        currentStreamUrlRef.current = data.streamUrl;
        setSubtitles(data.subtitles || []);

        // TV series: setup episodes
        const eps = (data.episodes || []) as StreamEpisode[];
        if (eps.length > 0) {
          setEpisodes(eps);
          setCurrentSeason(eps[0].season || "1");
          setCurrentEpisodeIdx(0);
        }

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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerMedia]);

  // ============================================================
  // INIT PLAYER saat streamUrl pertama kali di-set
  // ============================================================
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    // Hanya init kalau HLS belum ada (initial load)
    // Untuk perubahan source berikutnya, pakai changeStreamSource
    if (!hlsRef.current) {
      // Check native HLS first
      const video = videoRef.current;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.play().catch(() => {});
      } else {
        initHlsPlayer(streamUrl);
      }
    }

    return () => {
      // Cleanup saat modal close
      if (hlsRef.current && !playerMedia) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, initHlsPlayer, playerMedia]);

  // ============================================================
  // EPISODE / SEASON CHANGE (no re-mount)
  // ============================================================
  const handleEpisodeChange = (idx: number) => {
    const ep = currentSeasonEpisodes[idx];
    if (!ep) return;
    setCurrentEpisodeIdx(idx);
    setSubtitles(ep.subtitles || []);
    changeStreamSource(ep.streamUrl);
  };

  const handleSeasonChange = (season: string) => {
    setCurrentSeason(season);
    setCurrentEpisodeIdx(0);
    const firstEp = episodes.find((e) => (e.season || "1") === season);
    if (firstEp) {
      setSubtitles(firstEp.subtitles || []);
      changeStreamSource(firstEp.streamUrl);
    }
  };

  // ============================================================
  // AUTO-LOAD SUBTITLE (English priority)
  // ============================================================
  useEffect(() => {
    if (!streamUrl || subtitles.length === 0) return;
    const video = videoRef.current;
    if (!video) return;

    const timer = setTimeout(() => {
      // Clear existing tracks
      while (video.firstChild) {
        if (video.firstChild.nodeName === "TRACK") {
          video.removeChild(video.firstChild);
        } else {
          break;
        }
      }

      const englishSub = subtitles.find((s) => s.language === "english");
      const subToLoad = englishSub || subtitles[0];
      if (!subToLoad) return;

      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = subToLoad.label;
      track.srclang = subToLoad.language || "en";
      track.src = getStreamProxyUrl(subToLoad.url);
      video.appendChild(track);

      setTimeout(() => {
        const lastTrack = video.textTracks[video.textTracks.length - 1];
        if (lastTrack) {
          lastTrack.mode = "showing";
        }
      }, 500);
    }, 1500);

    return () => clearTimeout(timer);
  }, [streamUrl, subtitles]);

  // ============================================================
  // CLEANUP on unmount
  // ============================================================
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  if (!playerMedia) return null;

  const isTV = playerMedia.type === "tv" && episodes.length > 0;

  return (
    <Dialog open={!!playerMedia} onOpenChange={(open) => !open && closePlayer()}>
      <DialogContent className="max-w-[95vw] overflow-hidden rounded-xl border-0 bg-black p-0 md:max-w-5xl">
        <DialogTitle className="sr-only">{playerMedia.title}</DialogTitle>

        {/* Close button */}
        <button
          onClick={closePlayer}
          className="absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:opacity-100 focus:opacity-100"
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

        {/* Video player — native controls only, NO key prop (no re-mount) */}
        {!loading && !error && streamUrl && (
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              className="h-full w-full"
              controls
              controlsList="nodownload"
              playsInline
              autoPlay
            />
          </div>
        )}

        {/* TV SERIES: Season & Episode Selector */}
        {!loading && !error && isTV && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-zinc-950 p-3">
            {seasons.length > 1 && (
              <Select value={currentSeason} onValueChange={handleSeasonChange}>
                <SelectTrigger className="h-8 w-24 shrink-0 border-white/20 bg-zinc-900 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      Season {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {seasons.length === 1 && (
              <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white/80">
                Season {currentSeason}
              </span>
            )}

            <Select
              value={String(currentEpisodeIdx)}
              onValueChange={(v) => handleEpisodeChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-44 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSeasonEpisodes.map((ep, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">
                    E{ep.episode || idx + 1} — {ep.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="ml-auto text-[10px] text-white/50">
              {currentEpisodeIdx + 1} / {currentSeasonEpisodes.length}
            </span>

            <div className="flex gap-1">
              <button
                onClick={() => currentEpisodeIdx > 0 && handleEpisodeChange(currentEpisodeIdx - 1)}
                disabled={currentEpisodeIdx === 0}
                className="flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs text-white/80 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  currentEpisodeIdx < currentSeasonEpisodes.length - 1 &&
                  handleEpisodeChange(currentEpisodeIdx + 1)
                }
                disabled={currentEpisodeIdx === currentSeasonEpisodes.length - 1}
                className="flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs text-white/80 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
