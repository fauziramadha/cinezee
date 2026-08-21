"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Hls from "hls.js";
import { X, AlertCircle, Loader2, Settings, Volume2, Server } from "lucide-react";
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

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api/vps";

const SWITCHING_TIMEOUT_MS = 20000;

interface ServerInfo {
  id: number;
  title: string;
  stream_url: string;
}

interface StreamInfo {
  content: {
    id: number;
    cinemacity_id: string;
    title: string;
    type: string;
  };
  stream_url: string;
  servers: ServerInfo[];
  episodes: {
    season: number;
    episode: number;
    title: string;
    stream_url: string;
  }[];
  subtitles: {
    name: string;
    url: string;
  }[];
  expires_at: string;
}

// FIX B: Subtitle source - bisa dari manual (admin upload) atau dari cinemacity
interface SubtitleTrack {
  name: string;
  url: string;        // Full URL ke subtitle proxy
  isManual: boolean;  // true kalau dari admin upload
  isIndo: boolean;
}

async function findCinemacityContent(
  media: any
): Promise<{ cinemacity_id: string; slug: string; type: string } | null> {
  if (media.cinemacityId || media.cinemacity_id) {
    return {
      cinemacity_id: String(media.cinemacityId || media.cinemacity_id),
      slug: media.slug || "",
      type: media.type === "tv" ? "tv" : "movie",
    };
  }

  try {
    const res = await fetch(
      `${VPS_API_BASE}/api/search?q=${encodeURIComponent(media.title || "")}`
    );
    const data = await res.json();
    if (data.success && data.data?.results?.length > 0) {
      const titleLower = (media.title || "").toLowerCase();
      const match =
        data.data.results.find(
          (r: any) => r.title.toLowerCase() === titleLower
        ) ||
        data.data.results.find((r: any) =>
          r.title.toLowerCase().includes(titleLower)
        );
      if (match) {
        return {
          cinemacity_id: String(match.cinemacity_id),
          slug: match.slug,
          type: match.type,
        };
      }
    }
  } catch (e) {
    console.error("Search VPS failed:", e);
  }
  return null;
}

async function getStreamInfo(
  cinemacityId: string,
  season?: string,
  episode?: string
): Promise<StreamInfo> {
  const params = new URLSearchParams();
  if (season) params.set("season", season);
  if (episode) params.set("episode", episode);
  const query = params.toString();
  const url = `${VPS_API_BASE}/api/stream/info/${cinemacityId}${query ? "?" + query : ""}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success)
    throw new Error(data.error || "Failed to get stream info");
  return data.data;
}

// FIX B: Check manual subtitle di /api/subtitle/manual
// Return null kalau tidak ada, return SubtitleTrack kalau ada
async function checkManualSubtitle(
  title: string,
  type: string,
  season?: string,
  episode?: string
): Promise<SubtitleTrack | null> {
  try {
    const params = new URLSearchParams({
      title,
      type,
      format: "vtt",
    });
    if (season) params.set("season", season);
    if (episode) params.set("episode", episode);

    const url = `/api/subtitle/manual?${params.toString()}`;
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) {
      // Cek header X-Subtitle-Source untuk konfirmasi
      const source = res.headers.get("X-Subtitle-Source");
      if (source === "manual") {
        return {
          name: "Indonesia (Manual)",
          url: url,
          isManual: true,
          isIndo: true,
        };
      }
    }
    return null;
  } catch (e) {
    console.error("Check manual subtitle failed:", e);
    return null;
  }
}

interface VideoPlayerProps {
  streamUrl: string;
  subtitles: SubtitleTrack[];
  defaultSubtitleIdx: number;
  onSwitchingChange: (switching: boolean) => void;
  onError: (msg: string) => void;
}

function VideoPlayer({
  streamUrl,
  subtitles,
  defaultSubtitleIdx,
  onSwitchingChange,
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subtitleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [audioTracks, setAudioTracks] = useState<Hls.AudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
  const [qualityLevels, setQualityLevels] = useState<Hls.Level[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);

  const handleSwitchingDone = useCallback(() => {
    onSwitchingChange(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [onSwitchingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    onSwitchingChange(true);

    timeoutRef.current = setTimeout(() => {
      console.error("[Player] Switching timeout");
      onError("Loading terlalu lama. Coba server/episode lain atau refresh halaman.");
      handleSwitchingDone();
    }, SWITCHING_TIMEOUT_MS);

    // Detect Safari (including iOS Safari) - use native HLS for better performance
    // Safari's native HLS player handles buffering, prefetch, adaptive bitrate
    // much better than hls.js on iOS (which causes 6-second stops)
    const isSafari = /^((?!chrome|android).)*safari/i.test(
      navigator.userAgent
    );
    const canPlayNativeHls = video.canPlayType(
      "application/vnd.apple.mpegurl"
    );

    if (isSafari && canPlayNativeHls) {
      // Use Safari's NATIVE HLS player - much more efficient on iOS
      video.src = streamUrl;

      const onLoadedMeta = () => {
        handleSwitchingDone();
        video.play().catch(() => {});

        // FIX: Force enable default subtitle for Safari native HLS
        // Safari doesn't auto-show <track> elements, must set mode = "showing"
        if (defaultSubtitleIdx >= 0) {
          const enableSub = () => {
            const tracks = video.textTracks;
            if (tracks && tracks.length > defaultSubtitleIdx) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = i === defaultSubtitleIdx ? "showing" : "disabled";
              }
            }
          };
          enableSub();
          setTimeout(enableSub, 500);
          setTimeout(enableSub, 1500);
          setTimeout(enableSub, 3000);
        }
      };
      const onVideoError = () => {
        handleSwitchingDone();
        onError("Stream error. Coba server/episode lain atau refresh halaman.");
      };
      video.addEventListener("loadedmetadata", onLoadedMeta);
      video.addEventListener("error", onVideoError);

      hlsRef.current = {
        destroy: () => {
          video.removeEventListener("loadedmetadata", onLoadedMeta);
          video.removeEventListener("error", onVideoError);
          video.removeAttribute("src");
          video.load();
        },
      } as any;
    } else if (Hls.isSupported()) {
      // Buffer config: prefetch 30 segments at edge, hls.js buffers 120s ahead
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
        // Large buffer = more room for slow MISS segments
        maxBufferLength: 120,
        maxMaxBufferLength: 300,
        backBufferLength: 60,
        // Retry config (reasonable, not aggressive)
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 10000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 8000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 500,
        levelLoadingMaxRetryTimeout: 8000,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
        // Start prefetch immediately
        startFragPrefetch: true,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        handleSwitchingDone();
        video.play().catch(() => {});

        setAudioTracks(hls.audioTracks || []);
        const indoTrack = (hls.audioTracks || []).findIndex(
          (t) =>
            t.name?.toLowerCase().includes("indonesia") ||
            t.lang?.toLowerCase().includes("id")
        );
        if (indoTrack >= 0) {
          hls.audioTrack = indoTrack;
          setCurrentAudioTrack(indoTrack);
        }

        setQualityLevels(hls.levels || []);
        setCurrentQuality(-1);

        if (defaultSubtitleIdx >= 0) {
          const enableDefaultSub = () => {
            const tracks = video.textTracks;
            if (tracks && tracks.length > defaultSubtitleIdx) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = i === defaultSubtitleIdx ? "showing" : "disabled";
              }
            }
          };
          enableDefaultSub();
          const t1 = setTimeout(enableDefaultSub, 500);
          const t2 = setTimeout(enableDefaultSub, 1500);
          subtitleTimersRef.current.push(t1, t2);
        }
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        setAudioTracks(hls.audioTracks || []);
      });

      hls.on(Hls.Events.LEVELS_UPDATED, () => {
        setQualityLevels(hls.levels || []);
      });

      // FIX v2: Retry counter untuk fatal errors
      let retryCount = 0;
      const MAX_RETRIES = 3;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        retryCount++;
        console.warn(`[Player] Fatal error #${retryCount}/${MAX_RETRIES}:`, data.type, data.details);

        if (retryCount > MAX_RETRIES) {
          handleSwitchingDone();
          onError("Stream error setelah 3x retry. Coba server/episode lain atau refresh halaman.");
          hls.destroy();
          return;
        }

        // Set switching=true lagi saat retry
        onSwitchingChange(true);

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Coba startLoad dulu
            console.log("[Player] Network error, retrying with startLoad...");
            hls.startLoad();
            // Kalau masih gagal dalam 10 detik, destroy + recreate
            timeoutRef.current = setTimeout(() => {
              console.log("[Player] startLoad failed, recreating HLS instance...");
              try {
                hls.destroy();
              } catch {}
              // Recreate HLS instance
              const newHls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                startLevel: -1,
                maxBufferLength: 120,
                maxMaxBufferLength: 600,
                backBufferLength: 90,
                fragLoadingMaxRetry: 30,
                fragLoadingRetryDelay: 500,
                fragLoadingMaxRetryTimeout: 64000,
                manifestLoadingMaxRetry: 10,
                manifestLoadingRetryDelay: 1000,
                manifestLoadingMaxRetryTimeout: 20000,
                levelLoadingMaxRetry: 10,
                levelLoadingRetryDelay: 1000,
                levelLoadingMaxRetryTimeout: 20000,
                fragLoadingTimeOut: 60000,
                manifestLoadingTimeOut: 20000,
                levelLoadingTimeOut: 20000,
                startFragPrefetch: true,
                nudgeOffset: 0.1,
                nudgeMaxRetry: 10,
                nudgeOnDiscard: true,
              });
              hlsRef.current = newHls;
              newHls.loadSource(streamUrl);
              newHls.attachMedia(video);
              // Re-register events for new instance
              newHls.on(Hls.Events.MANIFEST_PARSED, () => {
                handleSwitchingDone();
                video.play().catch(() => {});
              });
              newHls.on(Hls.Events.ERROR, (evt2, data2) => {
                if (data2.fatal) {
                  retryCount++;
                  if (retryCount > MAX_RETRIES) {
                    handleSwitchingDone();
                    onError("Stream error setelah retry. Coba server/episode lain.");
                    newHls.destroy();
                  } else {
                    newHls.startLoad();
                  }
                }
              });
            }, 10000);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("[Player] Media error, recovering...");
            hls.recoverMediaError();
            timeoutRef.current = setTimeout(() => {
              handleSwitchingDone();
            }, 5000);
            break;
          default:
            handleSwitchingDone();
            onError("Stream error. Coba server/episode lain.");
            hls.destroy();
            break;
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS fallback (iPhone without MSE)
      video.src = streamUrl;

      const onLoadedMeta = () => {
        handleSwitchingDone();
        video.play().catch(() => {});
      };
      const onVideoError = () => {
        handleSwitchingDone();
        onError("Stream error. Coba server/episode lain atau refresh halaman.");
      };
      video.addEventListener("loadedmetadata", onLoadedMeta);
      video.addEventListener("error", onVideoError);

      hlsRef.current = {
        destroy: () => {
          video.removeEventListener("loadedmetadata", onLoadedMeta);
          video.removeEventListener("error", onVideoError);
          video.removeAttribute("src");
          video.load();
        },
      } as any;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      subtitleTimersRef.current.forEach((t) => clearTimeout(t));
      subtitleTimersRef.current = [];

      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          console.error("HLS destroy on unmount:", e);
        }
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAudioTrackChange = (trackId: string) => {
    const idx = parseInt(trackId);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = idx;
      setCurrentAudioTrack(idx);
    }
  };

  const handleQualityChange = (levelId: string) => {
    const idx = parseInt(levelId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
      setCurrentQuality(idx);
    }
  };

  const hasSettings = audioTracks.length > 1 || qualityLevels.length > 1;

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        autoPlay
        playsInline
        referrerPolicy="no-referrer"
      >
        {subtitles.map((sub, idx) => {
          const isDefault = idx === defaultSubtitleIdx;
          return (
            <track
              key={`${sub.url}-${idx}`}
              kind="subtitles"
              src={sub.url}
              srcLang={sub.isIndo ? "id" : "en"}
              label={sub.name}
              default={isDefault}
            />
          );
        })}
      </video>

      {hasSettings && (
        <div className="absolute right-12 top-2 z-30">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {showSettings && (
            <div className="absolute top-10 right-0 flex flex-col gap-2 rounded-lg bg-black/90 p-3 backdrop-blur-md">
              {audioTracks.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[10px] text-white/60">
                    <Volume2 className="h-3 w-3" /> Audio
                  </label>
                  <Select
                    value={String(currentAudioTrack)}
                    onValueChange={handleAudioTrackChange}
                  >
                    <SelectTrigger className="h-7 w-40 border-white/20 bg-zinc-900 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {audioTracks.map((track, idx) => (
                        <SelectItem
                          key={idx}
                          value={String(idx)}
                          className="text-xs"
                        >
                          {track.name || track.lang || `Track ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {qualityLevels.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-white/60">Quality</label>
                  <Select
                    value={String(currentQuality)}
                    onValueChange={handleQualityChange}
                  >
                    <SelectTrigger className="h-7 w-40 border-white/20 bg-zinc-900 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1" className="text-xs">
                        Auto
                      </SelectItem>
                      {qualityLevels.map((level, idx) => (
                        <SelectItem
                          key={idx}
                          value={String(idx)}
                          className="text-xs"
                        >
                          {level.height}p
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PlayerModal() {
  const {
    playerMedia,
    closePlayer,
    addToHistory,
    updateHistoryProgress,
    history,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [cinemacityData, setCinemacityData] = useState<{
    cinemacity_id: string;
    slug: string;
    type: string;
  } | null>(null);

  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentEpisode, setCurrentEpisode] = useState<string>("");
  const [currentServer, setCurrentServer] = useState<string>("");

  // FIX B: State untuk manual subtitle (dari admin upload)
  const [manualSubtitle, setManualSubtitle] = useState<SubtitleTrack | null>(null);

  // FIX: Counter untuk force remount VideoPlayer setiap kali player buka
  // Tanpa ini, kalau user tutup player dan buka lagi film yang SAMA,
  // streamUrl tidak berubah → VideoPlayer tidak remount → HLS instance lama stuck → loading forever
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    if (!playerMedia) {
      setStreamInfo(null);
      setCinemacityData(null);
      setError(null);
      setLoading(false);
      setCurrentServer("");
      setManualSubtitle(null);
      return;
    }

    // FIX: Increment mountKey setiap kali playerMedia berubah
    setMountKey(prev => prev + 1);

    let cancelled = false;

    async function init() {
      setStreamInfo(null);
      setCinemacityData(null);
      setLoading(true);
      setError(null);

      try {
        const ccData = await findCinemacityContent(playerMedia);
        if (!ccData) {
          throw new Error("Konten ini tidak tersedia di server streaming kami.");
        }

        if (cancelled) return;
        setCinemacityData(ccData);

        const info = await getStreamInfo(ccData.cinemacity_id);
        if (cancelled) return;
        setStreamInfo(info);

        if (ccData.type === "tv" && info.episodes?.length > 0) {
          const startSeason =
            (playerMedia as any)._currentSeason ||
            String(info.episodes[0].season);
          const startEpisode =
            (playerMedia as any)._currentEpisode ||
            String(info.episodes[0].episode);
          setCurrentSeason(startSeason);
          setCurrentEpisode(startEpisode);
        }

        if (info.servers?.length > 1) {
          setCurrentServer("0");
        } else {
          setCurrentServer("");
        }

        const existing = history.find((h) => h.id === playerMedia.id);
        if (!existing) {
          addToHistory({
            ...playerMedia,
            watchedAt: new Date().toISOString(),
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load stream");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [playerMedia]);

  // FIX B: Refetch streamInfo + check manual subtitle saat ganti episode
  useEffect(() => {
    if (!cinemacityData || !streamInfo) return;
    if (cinemacityData.type !== "tv") return;
    if (!currentSeason || !currentEpisode) return;

    let cancelled = false;

    async function refetchSubtitles() {
      try {
        const freshInfo = await getStreamInfo(
          cinemacityData.cinemacity_id,
          currentSeason,
          currentEpisode
        );
        if (cancelled) return;
        setStreamInfo((prev) =>
          prev
            ? {
                ...prev,
                subtitles: freshInfo.subtitles,
                episodes: freshInfo.episodes,
              }
            : freshInfo
        );
      } catch (e) {
        console.error("Refetch subtitles failed:", e);
      }
    }

    refetchSubtitles();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSeason, currentEpisode]);

  // FIX B: Check manual subtitle saat streamInfo berubah atau episode berubah
  useEffect(() => {
    if (!streamInfo?.content?.title) {
      setManualSubtitle(null);
      return;
    }

    let cancelled = false;

    async function checkManual() {
      const manual = await checkManualSubtitle(
        streamInfo!.content.title,
        streamInfo!.content.type,
        currentSeason || undefined,
        currentEpisode || undefined
      );
      if (cancelled) return;
      setManualSubtitle(manual);
    }

    checkManual();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamInfo, currentSeason, currentEpisode]);

  const streamUrl = useMemo(() => {
    if (!cinemacityData || !streamInfo) return "";

    const params = new URLSearchParams();
    params.set("slug", cinemacityData.slug);
    params.set("type", cinemacityData.type);

    if (cinemacityData.type === "tv" && currentSeason && currentEpisode) {
      params.set("season", currentSeason);
      params.set("episode", currentEpisode);
    }

    if (currentServer !== "" && streamInfo.servers?.length > 1) {
      params.set("server", currentServer);
    }

    return `${VPS_API_BASE}/api/stream/play/${cinemacityData.cinemacity_id}?${params.toString()}`;
  }, [cinemacityData, streamInfo, currentSeason, currentEpisode, currentServer]);

  const handleSwitchingChange = useCallback((isSwitching: boolean) => {
    setSwitching(isSwitching);
  }, []);

  const handlePlayerError = useCallback((msg: string) => {
    setError(msg);
    setSwitching(false);
  }, []);

  const handleServerChange = (serverId: string) => {
    setError(null);
    setCurrentServer(serverId);
  };

  const handleEpisodeChange = (episode: string) => {
    setError(null);
    setCurrentEpisode(episode);
  };

  const handleSeasonChange = (season: string) => {
    setError(null);
    setCurrentSeason(season);
    const firstEp = episodes.find((e) => String(e.season) === season);
    if (firstEp) setCurrentEpisode(String(firstEp.episode));
  };

  const episodes = streamInfo?.episodes || [];
  const vpsSubtitles = streamInfo?.subtitles || [];
  const servers = streamInfo?.servers || [];

  // FIX B: Combine manual subtitle (PRIORITY) + VPS subtitles
  // Manual subtitle selalu di index 0, jadi jadi default
  const subtitles: SubtitleTrack[] = useMemo(() => {
    const combined: SubtitleTrack[] = [];

    if (manualSubtitle) {
      combined.push(manualSubtitle);
    }

    vpsSubtitles.forEach((s) => {
      const isIndo =
        s.name.toLowerCase().includes("indonesia") ||
        s.name.toLowerCase().includes("malay");
      combined.push({
        name: s.name + (manualSubtitle ? "" : ""),
        url: `${VPS_API_BASE}/api/subtitle?url=${encodeURIComponent(s.url)}`,
        isManual: false,
        isIndo,
      });
    });

    return combined;
  }, [manualSubtitle, vpsSubtitles]);

  const seasons = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((e) => set.add(String(e.season)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [episodes]);

  const currentSeasonEpisodes = useMemo(() => {
    return episodes.filter((e) => String(e.season) === currentSeason);
  }, [episodes, currentSeason]);

  const currentEpisodeIdx = useMemo(() => {
    return currentSeasonEpisodes.findIndex(
      (e) => String(e.episode) === currentEpisode
    );
  }, [currentSeasonEpisodes, currentEpisode]);

  const hasMultipleServers = servers.length > 1;

  // FIX B: Default subtitle - kalau ada manual, pakai manual (idx 0)
  // Kalau tidak, prefer Indonesia, fallback English Full, fallback pertama
  const defaultSubtitleIdx = useMemo(() => {
    if (subtitles.length === 0) return -1;
    if (manualSubtitle) return 0; // Manual selalu default

    const indoIdx = subtitles.findIndex(
      (s) => s.isIndo
    );
    if (indoIdx >= 0) return indoIdx;

    const englishFullIdx = subtitles.findIndex(
      (s) =>
        s.name.toLowerCase().includes("english") &&
        s.name.toLowerCase().includes("full")
    );
    if (englishFullIdx >= 0) return englishFullIdx;

    return 0;
  }, [subtitles, manualSubtitle]);

  if (!playerMedia) return null;

  const isTV = cinemacityData?.type === "tv" && episodes.length > 0;

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
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={closePlayer}>
                Close
              </Button>
              {hasMultipleServers && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    const next = (parseInt(currentServer || "0") + 1) % servers.length;
                    handleServerChange(String(next));
                  }}
                >
                  Coba Server Lain
                </Button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && streamUrl && (
          <div className="relative aspect-video w-full bg-black">
            <VideoPlayer
              key={`${streamUrl}-${mountKey}`}
              streamUrl={streamUrl}
              subtitles={subtitles}
              defaultSubtitleIdx={defaultSubtitleIdx}
              onSwitchingChange={handleSwitchingChange}
              onError={handlePlayerError}
            />

            {switching && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <p className="text-xs text-white/70">Loading...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Server Selector */}
        {!loading && !error && hasMultipleServers && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-zinc-950 p-3">
            <span className="flex items-center gap-1 text-xs font-medium text-white/60">
              <Server className="h-3 w-3" /> Server:
            </span>
            <Select value={currentServer} onValueChange={handleServerChange}>
              <SelectTrigger className="h-8 w-full max-w-xs shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-72">
                <SelectValue placeholder="Pilih server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((srv) => (
                  <SelectItem
                    key={srv.id}
                    value={String(srv.id)}
                    className="text-xs"
                  >
                    {srv.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-[10px] text-white/40">
              {servers.length} server tersedia
            </span>
          </div>
        )}

        {/* TV Episode Controls */}
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

            <Select value={currentEpisode} onValueChange={handleEpisodeChange}>
              <SelectTrigger className="h-8 w-40 shrink-0 border-white/20 bg-zinc-900 text-xs text-white sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSeasonEpisodes.map((ep) => (
                  <SelectItem
                    key={ep.episode}
                    value={String(ep.episode)}
                    className="text-xs"
                  >
                    E{ep.episode} — {ep.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="ml-auto text-[10px] text-white/50">
              {currentEpisodeIdx + 1} / {currentSeasonEpisodes.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  currentEpisodeIdx > 0 &&
                  handleEpisodeChange(
                    String(currentSeasonEpisodes[currentEpisodeIdx - 1].episode)
                  )
                }
                disabled={currentEpisodeIdx <= 0}
                className="flex h-8 items-center justify-center rounded-md bg-zinc-900 px-3 text-xs text-white/80 transition-colors hover:bg-zinc-800 disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  currentEpisodeIdx < currentSeasonEpisodes.length - 1 &&
                  handleEpisodeChange(
                    String(currentSeasonEpisodes[currentEpisodeIdx + 1].episode)
                  )
                }
                disabled={currentEpisodeIdx >= currentSeasonEpisodes.length - 1}
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
