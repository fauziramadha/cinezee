"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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

// ============================================================
// Config
// ============================================================
const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

// ============================================================
// Types
// ============================================================
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

// ============================================================
// Helpers
// ============================================================
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

async function getStreamInfo(cinemacityId: string): Promise<StreamInfo> {
  const res = await fetch(`${VPS_API_BASE}/api/stream/info/${cinemacityId}`);
  const data = await res.json();
  if (!data.success)
    throw new Error(data.error || "Failed to get stream info");
  return data.data;
}

// ============================================================
// PLAYER MODAL
// ============================================================
export function PlayerModal() {
  const {
    playerMedia,
    closePlayer,
    addToHistory,
    updateHistoryProgress,
    history,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [cinemacityData, setCinemacityData] = useState<{
    cinemacity_id: string;
    slug: string;
    type: string;
  } | null>(null);

  const [currentSeason, setCurrentSeason] = useState<string>("");
  const [currentEpisode, setCurrentEpisode] = useState<string>("");
  // PATCH 5: Multi-server state
  const [currentServer, setCurrentServer] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [audioTracks, setAudioTracks] = useState<Hls.AudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
  const [qualityLevels, setQualityLevels] = useState<Hls.Level[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!playerMedia) {
      setStreamInfo(null);
      setCinemacityData(null);
      setError(null);
      setLoading(true);
      setCurrentServer("");
      return;
    }

    let cancelled = false;

    async function init() {
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

        // PATCH 5: Set default server ke "0" kalau ada multiple servers
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

  // PATCH 5: Build stream URL dari scratch, include server param jika multi-server
  const streamUrl = useMemo(() => {
    if (!cinemacityData || !streamInfo) return "";

    const params = new URLSearchParams();
    params.set("slug", cinemacityData.slug);
    params.set("type", cinemacityData.type);

    if (cinemacityData.type === "tv" && currentSeason && currentEpisode) {
      params.set("season", currentSeason);
      params.set("episode", currentEpisode);
    }

    // Add server param only if multi-server and user selected a server
    if (currentServer !== "" && streamInfo.servers?.length > 1) {
      params.set("server", currentServer);
    }

    return `${VPS_API_BASE}/api/stream/play/${cinemacityData.cinemacity_id}?${params.toString()}`;
  }, [cinemacityData, streamInfo, currentSeason, currentEpisode, currentServer]);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // FIX: Paksa pakai hls.js di semua perangkat (termasuk iPhone)
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        setAudioTracks(hls.audioTracks || []);
      });

      hls.on(Hls.Events.LEVELS_UPDATED, () => {
        setQualityLevels(hls.levels || []);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("Stream error. Please try again.");
              hls.destroy();
              break;
          }
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playerMedia) return;

    const handleTimeUpdate = () => {
      if (video.currentTime > 0 && video.duration > 0) {
        updateHistoryProgress(
          playerMedia.id,
          video.currentTime,
          video.duration
        );
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [playerMedia, updateHistoryProgress, streamUrl]);

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

  // PATCH 5: Handler untuk ganti server
  const handleServerChange = (serverId: string) => {
    setCurrentServer(serverId);
  };

  const episodes = streamInfo?.episodes || [];
  const subtitles = streamInfo?.subtitles || [];
  // PATCH 5: Get servers list
  const servers = streamInfo?.servers || [];

  const seasons = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((e) => set.add(String(e.season)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [episodes]);

  const currentSeasonEpisodes = useMemo(() => {
    return episodes.filter((e) => String(e.season) === currentSeason);
  }, [episodes, currentSeason]);

  const handleEpisodeChange = (episode: string) => setCurrentEpisode(episode);
  const handleSeasonChange = (season: string) => {
    setCurrentSeason(season);
    const firstEp = episodes.find((e) => String(e.season) === season);
    if (firstEp) setCurrentEpisode(String(firstEp.episode));
  };

  const currentEpisodeIdx = useMemo(() => {
    return currentSeasonEpisodes.findIndex(
      (e) => String(e.episode) === currentEpisode
    );
  }, [currentSeasonEpisodes, currentEpisode]);

  // FIX: Hanya tampilkan settings jika ada pilihan Audio (>1) atau Quality (>1)
  const hasSettings = audioTracks.length > 1 || qualityLevels.length > 1;
  // PATCH 5: Cek apakah ada multiple servers
  const hasMultipleServers = servers.length > 1;

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
              autoPlay
              playsInline
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            >
              {subtitles.map((sub, idx) => {
                const isIndo = sub.name.toLowerCase().includes('indonesia') || sub.name.toLowerCase().includes('malay');
                const subUrl = `${VPS_API_BASE}/api/subtitle?url=${encodeURIComponent(sub.url)}`;
                return (
                  <track
                    key={idx}
                    kind="subtitles"
                    src={subUrl}
                    srcLang={isIndo ? 'id' : 'en'}
                    label={sub.name}
                    default={isIndo}
                  />
                );
              })}
            </video>

            {/* FIX: Settings Button dipindah ke pojok kanan atas & hanya muncul jika hasSettings true */}
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
                    {/* Audio Track Selector */}
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

                    {/* Quality Selector */}
                    {qualityLevels.length > 1 && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/60">
                          Quality
                        </label>
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
        )}

        {/* PATCH 5: Server Selector (untuk film multi-server) */}
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
