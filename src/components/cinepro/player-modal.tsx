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
// SUBTITLE PREFERENCE — persist ke localStorage
// ============================================================
const SUBTITLE_PREF_KEY = "cinestream_subtitle_pref";

function getSavedSubtitlePref(): { label: string; language: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SUBTITLE_PREF_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveSubtitlePref(label: string, language: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUBTITLE_PREF_KEY, JSON.stringify({ label, language }));
  } catch {}
}

// Get saved pref OR default (Indonesian)
function getEffectiveDefaultSub(
  subtitles: Subtitle[]
): Subtitle | null {
  const saved = getSavedSubtitlePref();

  // Kalau user pernah pilih "off", return null (no subtitle)
  if (saved && saved.label === "__off__") {
    return null;
  }

  // Cari subtitle yang cocok dengan saved preference
  if (saved) {
    const matchByLabel = subtitles.find((s) => s.label === saved.label);
    if (matchByLabel) return matchByLabel;

    const matchByLang = subtitles.find((s) => s.language === saved.language);
    if (matchByLang) return matchByLang;
  }

  // Default: Indonesian > English (Full) > First
  const indoSub = subtitles.find(
    (s) =>
      s.label.toLowerCase().includes("indonesia") ||
      s.label.toLowerCase().includes("bahasa indonesia")
  );
  const englishFull = subtitles.find(
    (s) => s.language === "english" && s.type === "full"
  );
  const englishAny = subtitles.find((s) => s.language === "english");
  return indoSub || englishFull || englishAny || subtitles[0] || null;
}

// ============================================================
// HLS.js Loader — cache busting untuk m3u8 URLs
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
  const userInteractedRef = useRef(false);

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
  // ============================================================
  const changeStreamSource = useCallback((newUrl: string) => {
    const video = videoRef.current;
    if (!video || !newUrl) return;

    currentStreamUrlRef.current = newUrl;
    setStreamUrl(newUrl);

    if (video.canPlayType("application/vnd.apple.mpegurl") && !hlsRef.current) {
      video.src = newUrl;
      video.play().catch(() => {});
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.loadSource(newUrl);
    }
  }, []);

  // ============================================================
  // INIT HLS PLAYER
  // ============================================================
  const initHlsPlayer = useCallback(async (url: string) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }

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
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1024 * 1024,
        backBufferLength: 30,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 8000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 500,
        loader: makeCustomLoader(Hls),
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, async (_event: any, data: any) => {
        if (!data.fatal) return;

        const currentMedia = playerMediaRef.current;
        console.warn("[HLS FATAL ERROR]", data.type, data.details);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("[HLS] Network error, retrying...");
            hls.startLoad();
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("[HLS] Media error, recovering...");
            hls.recoverMediaError();
            break;

          default:
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

    if (!hlsRef.current) {
      const video = videoRef.current;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.play().catch(() => {});
      } else {
        initHlsPlayer(streamUrl);
      }
    }

    return () => {
      if (hlsRef.current && !playerMedia) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, initHlsPlayer, playerMedia]);

  // ============================================================
  // EPISODE / SEASON CHANGE
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
  // AUTO-LOAD SUBTITLE — Load SEMUA tracks, default = saved pref OR Indonesian
  // Save user preference saat user ganti subtitle
  // ============================================================
  useEffect(() => {
    if (!streamUrl || subtitles.length === 0) return;
    const video = videoRef.current;
    if (!video) return;

    // Reset interaction flag saat streamUrl berubah
    userInteractedRef.current = false;

    // ============================================================
    // DEFAULT: saved preference > Indonesian > English > First
    // ============================================================
    const defaultSub = getEffectiveDefaultSub(subtitles);

    // Case: user previously chose OFF → don't load any subtitle
    if (!defaultSub) {
      console.log("[Subtitle] User preference: OFF");
      const existingTracks = video.querySelectorAll("track");
      existingTracks.forEach((t) => t.remove());
      userInteractedRef.current = true;
      return;
    }

    // ============================================================
    // Load SEMUA subtitle tracks
    // ============================================================
    const loadAllTracks = () => {
      const existingTracks = video.querySelectorAll("track");
      existingTracks.forEach((t) => t.remove());

      subtitles.forEach((sub) => {
        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = sub.label;
        if (sub.label.toLowerCase().includes("indonesia")) {
          track.srclang = "id";
        } else if (sub.language === "english") {
          track.srclang = "en";
        } else {
          track.srclang = sub.language || "en";
        }
        track.src = getStreamProxyUrl(sub.url);
        if (sub === defaultSub) {
          track.default = true;
        }
        video.appendChild(track);
      });

      console.log(`[Subtitle] Loaded ${subtitles.length} tracks, default: ${defaultSub.label}`);
    };

    // ============================================================
    // Force-enable default subtitle (stop saat user interact)
    // ============================================================
    const forceEnableDefault = () => {
      if (userInteractedRef.current) return;

      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t.label === defaultSub.label && t.mode !== "showing") {
          t.mode = "showing";
          console.log("[Subtitle] Force-enabled:", t.label);
        }
      }
    };

    // ============================================================
    // DETECT user interaction → SAVE preference
    // ============================================================
    const onTrackChange = () => {
      const tracks = video.textTracks;
      let defaultShowing = false;
      let otherShowing = false;
      let allDisabled = true;

      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === "showing") {
          allDisabled = false;
          if (tracks[i].label === defaultSub.label) {
            defaultShowing = true;
          } else {
            otherShowing = true;
            // SAVE: user pilih subtitle lain → simpan preferensi
            const selectedSub = subtitles.find((s) => s.label === tracks[i].label);
            if (selectedSub) {
              saveSubtitlePref(selectedSub.label, selectedSub.language);
              console.log("[Subtitle] Saved user pref:", selectedSub.label);
            }
          }
        }
      }

      // User interacted: pilih track lain ATAU off
      if (otherShowing || (allDisabled && !userInteractedRef.current)) {
        userInteractedRef.current = true;
        // Save "off" preference kalau user disable semua
        if (allDisabled) {
          saveSubtitlePref("__off__", "off");
          console.log("[Subtitle] Saved user pref: OFF");
        }
      }
    };

    // ============================================================
    // Setup listeners
    // ============================================================
    const onLoadedMetadata = () => {
      loadAllTracks();
      setTimeout(forceEnableDefault, 100);
      setTimeout(forceEnableDefault, 500);
    };
    const onCanPlay = () => forceEnableDefault();
    const onPlay = () => {
      forceEnableDefault();
      setTimeout(forceEnableDefault, 500);
      setTimeout(forceEnableDefault, 1500);
    };

    const textTracks = video.textTracks;
    textTracks.addEventListener("change", onTrackChange);

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", onPlay);

    // Initial load
    if (video.readyState >= 1) {
      loadAllTracks();
      forceEnableDefault();
    }

    // Periodic force-enable
    const interval = setInterval(() => {
      if (!userInteractedRef.current) {
        forceEnableDefault();
      } else {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", onPlay);
      textTracks.removeEventListener("change", onTrackChange);
      clearInterval(interval);
    };
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

        {/* Video player — native controls only */}
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
