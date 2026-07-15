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

interface ServerOption {
  title: string;
  streamUrl: string;
  subtitles?: Subtitle[];
  episodes?: StreamEpisode[];
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

function getEffectiveDefaultSub(subtitles: Subtitle[]): Subtitle | null {
  const saved = getSavedSubtitlePref();
  if (saved && saved.label === "__off__") return null;
  if (saved) {
    const matchByLabel = subtitles.find((s) => s.label === saved.label);
    if (matchByLabel) return matchByLabel;
    const matchByLang = subtitles.find((s) => s.language === saved.language);
    if (matchByLang) return matchByLang;
  }
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
// Helper: cek apakah subtitle Indonesia ada
// ============================================================
function hasIndonesianSubtitle(subs: Subtitle[]): boolean {
  return subs.some(
    (s) =>
      s.label.toLowerCase().includes("indonesia") ||
      s.label.toLowerCase().includes("bahasa indonesia")
  );
}

// ============================================================
// Helper: fetch subtitle Indonesia dari Manual DB (no SubDL)
// ============================================================
async function fetchManualIndonesian(params: {
  title: string;
  type: "movie" | "tv";
  season?: string;
  episode?: string;
  server?: string;
}): Promise<Subtitle | null> {
  try {
    const searchParams = new URLSearchParams({
      title: params.title,
      type: params.type,
      format: "vtt",
    });
    if (params.season) searchParams.set("season", params.season);
    if (params.episode) searchParams.set("episode", params.episode);
    if (params.server) searchParams.set("server", params.server);

    console.log("[Subtitle] Fetching manual Indonesian for:", params.title, "server:", params.server);
    const res = await fetch(`/api/subtitle/manual?${searchParams.toString()}`);
    if (!res.ok) {
      console.warn("[Subtitle] Manual subtitle not found:", res.status);
      return null;
    }

    const blob = await res.blob();
    if (blob.size < 50) return null;

    const blobUrl = URL.createObjectURL(blob);
    console.log("[Subtitle] Manual Indonesian loaded");
    return {
      label: "Bahasa Indonesia",
      url: blobUrl,
      language: "bahasa",
      type: "full",
    };
  } catch (err) {
    console.warn("[Subtitle] Manual fetch error:", err);
    return null;
  }
}

// ============================================================
// HLS.js Loader
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
  // Reorder audio tracks by language (sama persis cinemacity asli)
  function reorderAudioByLang(m3u8: string): string {
    const nl = /\r\n/.test(m3u8) ? "\r\n" : "\n";
    const lines = m3u8.split(/\r?\n/);
    const isA = (s: string) => /^#EXT-X-MEDIA:TYPE=AUDIO\b/i.test(s);
    const pick = (re: RegExp, s: string) => (s.match(re) || [, ""])[1] || "";
    const lang = (s: string) => pick(/(?:^|,)LANGUAGE="([^"]*)"/i, s).toLowerCase();
    const name = (s: string) => pick(/(?:^|,)NAME="([^"]*)"/i, s);
    const audio = lines.filter(isA);
    if (!audio.length) return m3u8;
    const cmp = new Intl.Collator("en", { sensitivity: "base" }).compare;
    audio.sort((a, b) => cmp(lang(a), lang(b)) || cmp(name(a), name(b)) || cmp(a, b));
    let injected = false;
    return lines
      .map((l) => (isA(l) ? (injected ? null : ((injected = true), audio.join(nl))) : l))
      .filter(Boolean)
      .join(nl);
  }

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
        if (context.type === "manifest" && typeof response.data === "string") {
          response.data = reorderAudioByLang(response.data);
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

  // Server selector
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [currentServerIdx, setCurrentServerIdx] = useState<number>(0);

  // Quality & Audio
  const [availableQualities, setAvailableQualities] = useState<Array<{ height: number; level: number }>>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<Array<{ id: number; name: string }>>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

  // SubDL state
  const [subdlSubtitle, setSubdlSubtitle] = useState<Subtitle | null>(null);
  const [subdlLoading, setSubdlLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const currentStreamUrlRef = useRef<string>("");
  const playerMediaRef = useRef(playerMedia);
  const userInteractedRef = useRef(false);
  const prevBlobUrlRef = useRef<string | null>(null);

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
  // DERIVED: merged subtitles (cinemacity + SubDL)
  // ============================================================
  const allSubtitles = useMemo(() => {
    if (subdlSubtitle) {
      // SubDL di awal (highest priority for Indonesian)
      // Avoid duplicate kalau cinemacity juga punya Indonesian
      const filtered = subtitles.filter(
        (s) => !hasIndonesianSubtitle([s])
      );
      return [subdlSubtitle, ...filtered];
    }
    return subtitles;
  }, [subtitles, subdlSubtitle]);

  // ============================================================
  // CHANGE STREAM SOURCE
  // ============================================================
  const changeStreamSource = useCallback((newUrl: string) => {
    const video = videoRef.current;
    if (!video || !newUrl) return;
    currentStreamUrlRef.current = newUrl;
    setStreamUrl(newUrl);
    setAvailableQualities([]);
    setAvailableAudioTracks([]);
    setCurrentQuality(-1);
    setCurrentAudioTrack(-1);

    // Reset SubDL subtitle saat ganti source
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    setSubdlSubtitle(null);

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
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 134217728,
        backBufferLength: 10,
        loader: makeCustomLoader(Hls),
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels || [];
        const qualities = levels
          .map((level: any, idx: number) => ({ height: level.height || 0, level: idx }))
          .filter((q: any) => q.height > 0);
        setAvailableQualities(qualities);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_CREATED, () => {
        const audioTracks = hls.audioTracks || [];
        const tracks = audioTracks.map((track: any, idx: number) => ({
          id: idx,
          name: track.name || track.lang || `Track ${idx + 1}`,
        }));
        setAvailableAudioTracks(tracks);
      });

      hls.on(Hls.Events.ERROR, async (_event: any, data: any) => {
        if (!data.fatal) return;
        console.warn("[HLS FATAL ERROR]", data.type, data.details);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("[HLS] Network error, retrying startLoad...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("[HLS] Media error, recovering...");
            hls.recoverMediaError();
            break;
          default:
            const currentMedia = playerMediaRef.current;
            if (currentMedia?.source === "cinemacity" && currentMedia?.slug && retryCount < 3) {
              console.log(`[HLS] Fatal error, refreshing stream URL (retry ${retryCount + 1}/3)...`);
              setRetryCount((c) => c + 1);
              try {
                const freshData = await fetchCinemacityPlay(currentMedia.slug);
                if (freshData.streamUrl) {
                  changeStreamSource(freshData.streamUrl);
                  setSubtitles(freshData.subtitles || []);
                }
              } catch {
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
      setServers([]);
      setSubdlSubtitle(null);
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
        } else {
          setEpisodes([]);
        }

        const srvs = (data.servers || []) as ServerOption[];
        if (srvs.length > 1) {
          setServers(srvs);
          setCurrentServerIdx(0);
        } else {
          setServers([]);
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
      // Cleanup blob URL
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, [playerMedia]);

  // ============================================================
  // FETCH SUBDL INDONESIAN (kalau cinemacity gak punya Indonesian)
  // ============================================================
    useEffect(() => {
    // ============================================================
    // FIX: Jangan return early kalau subtitles.length === 0
    // Film dengan multiple servers (Supergirl) punya 0 cinemacity
    // subtitles di top level, tapi tetap perlu fetch manual subtitle!
    // ============================================================
    if (!playerMedia) {
      setSubdlSubtitle(null);
      return;
    }

    // Cek apakah cinemacity sudah punya Indonesian
    // Hanya skip kalau cinemacity PUNYA subtitles dan ada Indonesian
    if (subtitles.length > 0 && hasIndonesianSubtitle(subtitles)) {
      console.log("[Subtitle] Cinemacity has Indonesian, skip manual");
      setSubdlSubtitle(null);
      return;
    }

    // Cleanup previous blob URL
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }

    let cancelled = false;
    setSubdlLoading(true);

    const fetchSubdl = async () => {
      const title = playerMedia.title || "";
      const type = (playerMedia.type === "tv" ? "tv" : "movie") as "movie" | "tv";

      // Untuk TV: include season + episode dari current episode
      let season: string | undefined;
      let episode: string | undefined;
      if (type === "tv" && currentSeasonEpisodes[currentEpisodeIdx]) {
        season = currentSeason;
        episode = currentSeasonEpisodes[currentEpisodeIdx].episode || String(currentEpisodeIdx + 1);
      }

      // ============================================================
      // Extract server info (untuk subtitle lookup spesifik per server)
      // ============================================================
      let serverTitle: string | undefined;
      if (servers.length > 0 && servers[currentServerIdx]) {
        serverTitle = servers[currentServerIdx].title;
      }

      if (!title) {
        setSubdlLoading(false);
        return;
      }

      const manualSub = await fetchManualIndonesian({ title, type, season, episode, server: serverTitle });
      if (cancelled) return;

      if (manualSub) {
        prevBlobUrlRef.current = manualSub.url;
        setSubdlSubtitle(manualSub);
      } else {
        setSubdlSubtitle(null);
      }
      setSubdlLoading(false);
    };

    fetchSubdl();

    return () => {
      cancelled = true;
    };
    // Re-fetch saat playerMedia atau currentEpisodeIdx berubah
  }, [playerMedia, subtitles, currentSeason, currentEpisodeIdx, currentSeasonEpisodes]);

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
  // SERVER CHANGE
  // ============================================================
  const handleServerChange = (idx: number) => {
    const server = servers[idx];
    if (!server) return;
    setCurrentServerIdx(idx);
    setSubtitles(server.subtitles || []);

    if (server.episodes && server.episodes.length > 0) {
      setEpisodes(server.episodes);
      setCurrentSeason(server.episodes[0].season || "1");
      setCurrentEpisodeIdx(0);
      changeStreamSource(server.episodes[0].streamUrl);
    } else {
      changeStreamSource(server.streamUrl);
    }
    console.log(`[Player] Switched to server: ${server.title}`);
  };

  // ============================================================
  // QUALITY & AUDIO CHANGE
  // ============================================================
  const handleQualityChange = (level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
    setCurrentQuality(level);
  };

  const handleAudioTrackChange = (trackId: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = trackId;
    setCurrentAudioTrack(trackId);
  };

  // ============================================================
  // AUTO-LOAD SUBTITLE (pakai merged subtitles: cinemacity + SubDL)
  // ============================================================
  useEffect(() => {
    if (!streamUrl || allSubtitles.length === 0) return;
    const video = videoRef.current;
    if (!video) return;

    userInteractedRef.current = false;
    const initializationCompleteRef = { current: false };

    const defaultSub = getEffectiveDefaultSub(allSubtitles);

    if (!defaultSub) {
      const existingTracks = video.querySelectorAll("track");
      existingTracks.forEach((t) => t.remove());
      userInteractedRef.current = true;
      return;
    }

    const loadAllTracks = () => {
      const existingTracks = video.querySelectorAll("track");
      existingTracks.forEach((t) => t.remove());
      allSubtitles.forEach((sub) => {
        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = sub.label;
        if (sub.label.toLowerCase().includes("indonesia")) track.srclang = "id";
        else if (sub.language === "english") track.srclang = "en";
        else track.srclang = sub.language || "en";
        // SubDL subtitle pakai blob URL langsung (no proxy)
        // Cinemacity subtitle pakai proxy (cinemacity.cc block hotlink)
        const isBlobUrl = sub.url.startsWith("blob:");
        track.src = isBlobUrl ? sub.url : getStreamProxyUrl(sub.url);
        if (sub === defaultSub) track.default = true;
        video.appendChild(track);
      });
      console.log(`[Subtitle] Loaded ${allSubtitles.length} tracks (cinemacity + SubDL), default: ${defaultSub.label}`);
    };

    const forceEnableDefault = () => {
      if (userInteractedRef.current) return;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t.label === defaultSub.label && t.mode !== "showing") {
          t.mode = "showing";
          initializationCompleteRef.current = true;
        }
      }
    };

    const onTrackChange = () => {
      if (!initializationCompleteRef.current) return;
      const tracks = video.textTracks;
      let otherShowing = false;
      let allDisabled = true;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === "showing") {
          allDisabled = false;
          if (tracks[i].label !== defaultSub.label) {
            otherShowing = true;
            const selectedSub = allSubtitles.find((s) => s.label === tracks[i].label);
            if (selectedSub) saveSubtitlePref(selectedSub.label, selectedSub.language);
          }
        }
      }
      if (otherShowing) {
        userInteractedRef.current = true;
      } else if (allDisabled && !userInteractedRef.current) {
        userInteractedRef.current = true;
        saveSubtitlePref("__off__", "off");
      }
    };

    const onLoadedMetadata = () => {
      loadAllTracks();
      setTimeout(forceEnableDefault, 100);
      setTimeout(forceEnableDefault, 500);
      setTimeout(forceEnableDefault, 1000);
    };
    const onCanPlay = () => forceEnableDefault();
    const onPlay = () => {
      forceEnableDefault();
      setTimeout(forceEnableDefault, 500);
      setTimeout(forceEnableDefault, 1500);
      setTimeout(forceEnableDefault, 3000);
    };

    const textTracks = video.textTracks;
    textTracks.addEventListener("change", onTrackChange);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", onPlay);

    if (video.readyState >= 1) {
      loadAllTracks();
      setTimeout(forceEnableDefault, 100);
      setTimeout(forceEnableDefault, 500);
    }

    const interval = setInterval(() => {
      if (!userInteractedRef.current) forceEnableDefault();
      else clearInterval(interval);
    }, 2000);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", onPlay);
      textTracks.removeEventListener("change", onTrackChange);
      clearInterval(interval);
    };
  }, [streamUrl, allSubtitles]);

  // ============================================================
  // CLEANUP
  // ============================================================
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
        prevBlobUrlRef.current = null;
      }
    };
  }, []);

  if (!playerMedia) return null;

  const isTV = playerMedia.type === "tv" && episodes.length > 0;
  const hasMultipleServers = servers.length > 1;
  const hasMultipleQualities = availableQualities.length > 1;
  const hasMultipleAudio = availableAudioTracks.length > 1;
  const showControlsBar = isTV || hasMultipleServers || hasMultipleQualities || hasMultipleAudio;

  return (
    <Dialog open={!!playerMedia} onOpenChange={(open) => !open && closePlayer()}>
      <DialogContent className="max-w-[95vw] overflow-hidden rounded-xl border-0 bg-black p-0 md:max-w-5xl">
        <DialogTitle className="sr-only">{playerMedia.title}</DialogTitle>

        <button
          onClick={closePlayer}
          className="absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:opacity-100 focus:opacity-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {loading && (
          <div className="flex aspect-video items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading stream...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-sm text-white/90">{error}</p>
            <Button variant="secondary" size="sm" onClick={closePlayer}>
              Close
            </Button>
          </div>
        )}

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
            {/* SubDL loading indicator (small, di pojok kanan bawah) */}
            {subdlLoading && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin text-white" />
                <span className="text-[10px] text-white/80">Searching ID subtitle...</span>
              </div>
            )}
          </div>
        )}

        {/* CONTROLS BAR */}
        {!loading && !error && streamUrl && showControlsBar && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-zinc-950 p-3">
            {hasMultipleServers && (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Server:</span>
                <Select value={String(currentServerIdx)} onValueChange={(v) => handleServerChange(Number(v))}>
                  <SelectTrigger className="h-8 w-40 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server, idx) => (
                      <SelectItem key={idx} value={String(idx)} className="text-xs">
                        {server.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {isTV && seasons.length > 1 && (
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

            {isTV && seasons.length === 1 && (
              <span className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white/80">
                Season {currentSeason}
              </span>
            )}

            {isTV && (
              <Select
                value={String(currentEpisodeIdx)}
                onValueChange={(v) => handleEpisodeChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-40 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-52">
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
            )}

            {hasMultipleQualities && (
              <Select value={String(currentQuality)} onValueChange={(v) => handleQualityChange(Number(v))}>
                <SelectTrigger className="h-8 w-24 shrink-0 border-white/20 bg-zinc-900 text-xs text-white">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1" className="text-xs">Auto</SelectItem>
                  {availableQualities
                    .slice()
                    .sort((a, b) => b.height - a.height)
                    .map((q) => (
                      <SelectItem key={q.level} value={String(q.level)} className="text-xs">
                        {q.height}p
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {hasMultipleAudio && (
              <Select value={String(currentAudioTrack)} onValueChange={(v) => handleAudioTrackChange(Number(v))}>
                <SelectTrigger className="h-8 w-32 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-40">
                  <SelectValue placeholder="Audio" />
                </SelectTrigger>
                <SelectContent>
                  {availableAudioTracks.map((track) => (
                    <SelectItem key={track.id} value={String(track.id)} className="text-xs">
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isTV && (
              <>
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
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
