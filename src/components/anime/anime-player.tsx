"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Server,
  Download,
  X,
  Maximize,
  Minimize,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================
interface StreamItem {
  name: string;
  url: string;
}

interface ServerItem {
  title: string;
  serverId: string;
  href: string;
}

interface QualityItem {
  title: string;
  serverList: ServerItem[];
}

interface EpisodeData {
  title: string;
  animeId?: string;
  defaultStreamingUrl?: string;
  hasPrevEpisode?: boolean;
  prevEpisode?: { episodeId: string } | null;
  hasNextEpisode?: boolean;
  nextEpisode?: { episodeId: string } | null;
  // Otakudesu structure
  server?: { qualities: QualityItem[] };
  downloadUrl?: { qualities: any[] };
  // Animasu structure
  streams?: StreamItem[];
  downloads?: any[];
}

interface AnimePlayerContentProps {
  animeId: string;
  episodeId: string;
  source?: "otakudesu" | "animasu";
}

export function AnimePlayerContent({
  animeId,
  episodeId,
  source = "otakudesu",
}: AnimePlayerContentProps) {
  const router = useRouter();
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player state
  const [selectedQuality, setSelectedQuality] = useState<string>("");
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [selectedStreamIdx, setSelectedStreamIdx] = useState<number>(0);
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showOpenInNewTab, setShowOpenInNewTab] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ============================================================
  // LOAD EPISODE DATA
  // ============================================================
  useEffect(() => {
    setLoading(true);
    setError(null);
    setStreamUrl("");
    setIframeLoading(true);
    setIframeError(false);
    setShowOpenInNewTab(false);

    const episodeEndpoint =
      source === "animasu"
        ? `/api/anime/animasu/episode/${episodeId}`
        : `/api/anime/episode/${episodeId}`;

    fetch(episodeEndpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.data || json?.streams) {
          // Animasu: data di root, Otakudesu: data di json.data
          const data =
            source === "animasu"
              ? {
                  title: json.title || "Episode",
                  streams: json.streams || [],
                  downloads: json.downloads || [],
                  hasNextEpisode: false,
                  hasPrevEpisode: false,
                }
              : json.data;
          setEpisode(data);

          if (source === "animasu") {
            // Animasu: streams[] langsung ada, auto-pilih 1080p > 720p
            const streams = data.streams || [];
            if (streams.length > 0) {
              const bestIdx =
                streams.findIndex((s) =>
                  s.name.toLowerCase().includes("1080")
                ) !== -1
                  ? streams.findIndex((s) =>
                      s.name.toLowerCase().includes("1080")
                    )
                  : streams.findIndex((s) =>
                      s.name.toLowerCase().includes("720")
                    ) !== -1
                  ? streams.findIndex((s) =>
                      s.name.toLowerCase().includes("720")
                    )
                  : 0;
              setSelectedStreamIdx(bestIdx);
              setStreamUrl(streams[bestIdx].url);
              setIframeLoading(false);
            }
          } else {
            // Otakudesu: auto-pilih quality terbaik
            const qualities = data.server?.qualities || [];
            if (qualities.length > 0) {
              const best =
                qualities.find((q) =>
                  q.title.toLowerCase().includes("1080")
                ) ||
                qualities.find((q) =>
                  q.title.toLowerCase().includes("720")
                ) ||
                qualities.find((q) => q.serverList.length > 0) ||
                qualities[0];
              setSelectedQuality(best.title);
              if (best.serverList.length > 0) {
                setSelectedServerId(best.serverList[0].serverId);
              }
            }
          }
        } else {
          throw new Error("Invalid response");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [episodeId, source]);

  // ============================================================
  // FETCH STREAM URL (Otakudesu only — saat server berubah)
  // ============================================================
  useEffect(() => {
    if (source !== "otakudesu" || !selectedServerId) return;

    setIframeLoading(true);
    setIframeError(false);
    setStreamUrl("");
    setShowOpenInNewTab(false);

    if (iframeLoadTimeoutRef.current) {
      clearTimeout(iframeLoadTimeoutRef.current);
      iframeLoadTimeoutRef.current = null;
    }

    fetch(`/api/anime/server/${selectedServerId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.data?.url) {
          setStreamUrl(json.data.url);
        } else if (episode?.defaultStreamingUrl) {
          setStreamUrl(episode.defaultStreamingUrl);
        } else {
          throw new Error("No stream URL");
        }
      })
      .catch(() => {
        if (episode?.defaultStreamingUrl) {
          setStreamUrl(episode.defaultStreamingUrl);
        } else {
          setIframeError(true);
        }
      })
      .finally(() => setIframeLoading(false));
  }, [selectedServerId, source, episode?.defaultStreamingUrl]);

  // ============================================================
  // TIMEOUT DETECTION: cek iframe blank
  // ============================================================
  useEffect(() => {
    if (!streamUrl || iframeError) return;

    iframeLoadTimeoutRef.current = setTimeout(() => {
      if (iframeLoading) {
        console.log("[Player] Iframe load timeout, showing Open in New Tab");
        setShowOpenInNewTab(true);
        setIframeLoading(false);
      }
    }, 8000);

    return () => {
      if (iframeLoadTimeoutRef.current) {
        clearTimeout(iframeLoadTimeoutRef.current);
      }
    };
  }, [streamUrl, iframeLoading, iframeError]);

  // ============================================================
  // Handle stream change (Animasu)
  // ============================================================
  const handleStreamChange = (idx: number) => {
    if (source === "animasu" && episode?.streams) {
      setSelectedStreamIdx(idx);
      setStreamUrl(episode.streams[idx].url);
      setIframeLoading(true);
      setIframeError(false);
      setShowOpenInNewTab(false);
    }
  };

  // ============================================================
  // Handle quality change (Otakudesu)
  // ============================================================
  const handleQualityChange = (qualityTitle: string) => {
    const qualities = episode?.server?.qualities || [];
    const q = qualities.find((qq) => qq.title === qualityTitle);
    if (q && q.serverList.length > 0) {
      setSelectedQuality(qualityTitle);
      setSelectedServerId(q.serverList[0].serverId);
    }
  };

  // ============================================================
  // Switch server / stream
  // ============================================================
  const switchServer = useCallback(() => {
    if (source === "animasu" && episode?.streams) {
      const nextIdx = (selectedStreamIdx + 1) % episode.streams.length;
      handleStreamChange(nextIdx);
      return;
    }
    // Otakudesu
    if (!episode || !selectedQuality) return;
    const qualities = episode.server?.qualities || [];
    const q = qualities.find((qq) => qq.title === selectedQuality);
    if (!q) return;
    const currentIdx = q.serverList.findIndex(
      (s) => s.serverId === selectedServerId
    );
    if (currentIdx === -1) return;
    const nextIdx = (currentIdx + 1) % q.serverList.length;
    setSelectedServerId(q.serverList[nextIdx].serverId);
  }, [
    episode,
    selectedQuality,
    selectedServerId,
    source,
    selectedStreamIdx,
  ]);

  // ============================================================
  // Fullscreen handler
  // ============================================================
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ============================================================
  // Navigate prev/next
  // ============================================================
  const goPrevEpisode = () => {
    if (episode?.hasPrevEpisode && episode.prevEpisode?.episodeId) {
      const watchBase =
        source === "animasu"
          ? `/anime/s2/watch/${animeId}`
          : `/anime/s1/watch/${animeId}`;
      router.push(`${watchBase}/${episode.prevEpisode.episodeId}`);
    }
  };

  const goNextEpisode = () => {
    if (episode?.hasNextEpisode && episode.nextEpisode?.episodeId) {
      const watchBase =
        source === "animasu"
          ? `/anime/s2/watch/${animeId}`
          : `/anime/s1/watch/${animeId}`;
      router.push(`${watchBase}/${episode.nextEpisode.episodeId}`);
    }
  };

  // ============================================================
  // Get current quality's server list (Otakudesu)
  // ============================================================
  const currentServers =
    episode?.server?.qualities?.find((q) => q.title === selectedQuality)
      ?.serverList || [];

  // ============================================================
  // Download links (handle both structures)
  // ============================================================
  const downloadQualities =
    episode?.downloadUrl?.qualities || episode?.downloads || [];

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================
  if (error || !episode) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">
            {error || "Episode tidak ditemukan"}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(
                source === "animasu"
                  ? `/anime/s2/${animeId}`
                  : `/anime/s1/${animeId}`
              )
            }
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Detail
          </Button>
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-6 pt-20">
        {/* Back button */}
        <button
          onClick={() =>
            router.push(
              source === "animasu"
                ? `/anime/s2/${animeId}`
                : `/anime/s1/${animeId}`
            )
          }
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Detail Anime
        </button>

        {/* Title */}
        <h1 className="mb-4 line-clamp-1 text-lg font-bold sm:text-xl">
          {episode.title}
        </h1>

        {/* === PLAYER === */}
        <div
          ref={playerContainerRef}
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
          style={{ minHeight: "200px" }}
        >
          {/* Loading overlay */}
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading stream...</p>
            </div>
          )}

          {/* Iframe */}
          {streamUrl && !iframeError && (
            <iframe
              key={streamUrl}
              src={streamUrl}
              className="h-full w-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="origin"
              onLoad={() => {
                setIframeLoading(false);
                if (iframeLoadTimeoutRef.current) {
                  clearTimeout(iframeLoadTimeoutRef.current);
                  iframeLoadTimeoutRef.current = null;
                }
              }}
              onError={() => {
                setIframeError(true);
                setIframeLoading(false);
              }}
              title={episode.title}
            />
          )}

          {/* Error overlay */}
          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <p className="mb-1 text-base font-semibold">Playback Error</p>
                <p className="text-sm text-white/60">
                  Server ini gagal load. Coba server lain.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={switchServer} size="sm" className="gap-2">
                  <Server className="h-3.5 w-3.5" />
                  Coba Server Lain
                </Button>
                {streamUrl && (
                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka di Tab Baru
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Open in New Tab overlay */}
          {showOpenInNewTab && streamUrl && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="mb-1 text-sm font-semibold">
                  Video tidak bisa di-embed
                </p>
                <p className="text-xs text-white/60">
                  Server ini memblokir iframe embed. Buka di tab baru untuk
                  menonton.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka di Tab Baru
                </a>
                <Button
                  onClick={switchServer}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Server className="h-3.5 w-3.5" />
                  Coba Server Lain
                </Button>
              </div>
            </div>
          )}

          {/* Fullscreen button */}
          {!iframeLoading && !iframeError && !showOpenInNewTab && (
            <button
              onClick={toggleFullscreen}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-primary"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* === CONTROLS BAR === */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={goPrevEpisode}
              disabled={!episode.hasPrevEpisode}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={goNextEpisode}
              disabled={!episode.hasNextEpisode}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {downloadQualities.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDownload(!showDownload)}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
        </div>

        {/* === QUALITY & SERVER SELECTOR === */}
        {source === "animasu" && episode.streams && episode.streams.length > 0 ? (
          // Animasu: stream selector
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" />
              Pilih Server Streaming
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Server:</span>
                <Select
                  value={String(selectedStreamIdx)}
                  onValueChange={(v) => handleStreamChange(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {episode.streams.map((s, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Kalau video tidak muncul, coba server lain. Beberapa server
              mungkin lambat.
            </p>
          </div>
        ) : source === "otakudesu" && episode.server?.qualities && episode.server.qualities.length > 0 ? (
          // Otakudesu: quality + server selector
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" />
              Pilih Quality & Server
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quality:</span>
                <Select
                  value={selectedQuality}
                  onValueChange={handleQualityChange}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {episode.server.qualities.map((q) => (
                      <SelectItem key={q.title} value={q.title}>
                        {q.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentServers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Server:</span>
                  <Select
                    value={selectedServerId}
                    onValueChange={setSelectedServerId}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentServers.map((s) => (
                        <SelectItem key={s.serverId} value={s.serverId}>
                          {s.title.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Kalau video tidak muncul, coba ganti server. Beberapa server
              mungkin lambat.
            </p>
          </div>
        ) : null}

        {/* === DOWNLOAD MODAL === */}
        {showDownload && downloadQualities.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Download className="h-4 w-4 text-primary" />
                Link Download
              </h3>
              <button
                onClick={() => setShowDownload(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {downloadQualities.map((q, idx) => {
                // Handle both structures
                const title = q.title || q.name || "Unknown";
                const size = q.size;
                const urls = q.urls || q.links || [];
                return (
                  <div key={idx} className="rounded border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">{title}</Badge>
                      {size && (
                        <span className="text-xs text-muted-foreground">
                          {size}
                        </span>
                      )}
                    </div>
                    {urls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {urls.map((u: any, uidx: number) => (
                          <a
                            key={uidx}
                            href={u.url || u.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            {u.title || u.host || `Link ${uidx + 1}`}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Tidak ada link download.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
