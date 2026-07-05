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
interface ServerItem {
  title: string;
  serverId: string;
  href: string;
}

interface QualityItem {
  title: string;
  serverList: ServerItem[];
}

interface DownloadQuality {
  title: string;
  size?: string;
  urls: { title: string; url: string }[];
}

interface EpisodeData {
  title: string;
  animeId: string;
  defaultStreamingUrl?: string;
  hasPrevEpisode: boolean;
  prevEpisode?: { episodeId: string } | null;
  hasNextEpisode: boolean;
  nextEpisode?: { episodeId: string } | null;
  server?: { qualities: QualityItem[] };
  downloadUrl?: { qualities: DownloadQuality[] };
}

interface AnimePlayerContentProps {
  animeId: string;
  episodeId: string;
  source?: "otakudesu" | "samehadaku";
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
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // LOAD EPISODE DATA
  // ============================================================
    useEffect(() => {
    setLoading(true);
    setError(null);
    setStreamUrl("");
    setIframeLoading(true);
    setIframeError(false);

    const episodeEndpoint =
      source === "samehadaku"
        ? `/api/anime/samehadaku/episode/${episodeId}`
        : `/api/anime/episode/${episodeId}`;

    fetch(episodeEndpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.data) {
          setEpisode(json.data);

          // Auto-pilih quality terbaik (720p > 480p > 360p)
          const qualities = json.data.server?.qualities || [];
          if (qualities.length > 0) {
            // Cari 720p dulu, fallback ke quality pertama
            const best =
              qualities.find((q: QualityItem) =>
                q.title.toLowerCase().includes("720")
              ) || qualities[0];

            setSelectedQuality(best.title);

            // Auto-pilih server pertama
            if (best.serverList.length > 0) {
              setSelectedServerId(best.serverList[0].serverId);
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
  // FETCH STREAM URL saat server berubah
  // ============================================================
    useEffect(() => {
    if (!selectedServerId) return;

    setIframeLoading(true);
    setIframeError(false);
    setStreamUrl("");

    const serverEndpoint =
      source === "samehadaku"
        ? `/api/anime/samehadaku/server/${selectedServerId}`
        : `/api/anime/server/${selectedServerId}`;

    fetch(serverEndpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.data?.url) {
          setStreamUrl(json.data.url);
        } else {
          throw new Error("No stream URL");
        }
      })
      .catch(() => {
        setIframeError(true);
      })
      .finally(() => setIframeLoading(false));
  }, [selectedServerId, source]);

  // ============================================================
  // Handle quality change
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
  // Handle server change
  // ============================================================
  const handleServerChange = (serverId: string) => {
    setSelectedServerId(serverId);
  };

  // ============================================================
  // Switch server (auto kalau error)
  // ============================================================
  const switchServer = useCallback(() => {
    if (!episode || !selectedQuality) return;
    const qualities = episode.server?.qualities || [];
    const q = qualities.find((qq) => qq.title === selectedQuality);
    if (!q) return;

    const currentIdx = q.serverList.findIndex(
      (s) => s.serverId === selectedServerId
    );
    if (currentIdx === -1) return;

    // Cari server berikutnya
    const nextIdx = (currentIdx + 1) % q.serverList.length;
    setSelectedServerId(q.serverList[nextIdx].serverId);
  }, [episode, selectedQuality, selectedServerId]);

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
        source === "samehadaku"
          ? `/anime/samehadaku/watch/${animeId}`
          : `/anime/watch/${animeId}`;
      router.push(`${watchBase}/${episode.prevEpisode.episodeId}`);
    }
  };

  const goNextEpisode = () => {
    if (episode?.hasNextEpisode && episode.nextEpisode?.episodeId) {
      const watchBase =
        source === "samehadaku"
          ? `/anime/samehadaku/watch/${animeId}`
          : `/anime/watch/${animeId}`;
      router.push(`${watchBase}/${episode.nextEpisode.episodeId}`);
    }
  };

  // ============================================================
  // Get current quality's server list
  // ============================================================
  const currentServers =
    episode?.server?.qualities?.find((q) => q.title === selectedQuality)
      ?.serverList || [];

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
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                router.push(
                  source === "samehadaku"
                    ? `/anime/samehadaku/${animeId}`
                    : `/anime/${animeId}`
                )
              }
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke Detail
            </Button>
          </div>
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
              source === "samehadaku"
                ? `/anime/samehadaku/${animeId}`
                : `/anime/${animeId}`
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
              onLoad={() => setIframeLoading(false)}
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
              <Button onClick={switchServer} size="sm" className="gap-2">
                <Server className="h-3.5 w-3.5" />
                Coba Server Lain
              </Button>
            </div>
          )}

          {/* Fullscreen button (overlay, top-right) */}
          {!iframeLoading && !iframeError && (
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
          {/* Left: Prev/Next */}
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

          {/* Right: Download */}
          {episode.downloadUrl?.qualities &&
            episode.downloadUrl.qualities.length > 0 && (
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
        {episode.server?.qualities &&
          episode.server.qualities.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4 text-primary" />
                Pilih Quality & Server
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {/* Quality selector */}
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

                {/* Server selector */}
                {currentServers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Server:</span>
                    <Select
                      value={selectedServerId}
                      onValueChange={handleServerChange}
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
          )}

        {/* === DOWNLOAD MODAL === */}
        {showDownload && episode.downloadUrl?.qualities && (
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
              {episode.downloadUrl.qualities.map((q, idx) => (
                <div
                  key={idx}
                  className="rounded border border-border p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline">{q.title}</Badge>
                    {q.size && (
                      <span className="text-xs text-muted-foreground">
                        {q.size}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.urls.map((u, uidx) => (
                      <a
                        key={uidx}
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        {u.title}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
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
