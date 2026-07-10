"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, AlertCircle, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DrakorPlayerViewProps {
  drakorId: string;
  episodeNumber: string;
  streamUrl: string;
  detail: any;
}

const QUALITY_OPTIONS = [
  { value: "360", label: "360p" },
  { value: "480", label: "480p" },
  { value: "720", label: "720p" },
  { value: "1080", label: "1080p" },
];

export function DrakorPlayerView({
  drakorId,
  episodeNumber,
  streamUrl: initialStreamUrl,
  detail,
}: DrakorPlayerViewProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);

  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState(initialStreamUrl);
  const [selectedQuality, setSelectedQuality] = useState("720");
  const [showSettings, setShowSettings] = useState(false);

  const title = detail?.title || "Drakor";
  const episodes = Array.isArray(detail?.episodes) ? detail.episodes : [];
  const watchBase = `/drakor/watch/${drakorId}`;
  const detailHref = `/drakor/${drakorId}`;

  const currentEpNum = parseInt(episodeNumber, 10);
  const prevEp = episodes.find((e: any) => e?.number === currentEpNum - 1);
  const nextEp = episodes.find((e: any) => e?.number === currentEpNum + 1);

  // Cleanup HLS instance
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Setup HLS playback
  const setupVideo = useCallback(
    (url: string) => {
      const video = videoRef.current;
      if (!video || !url) {
        setLoading(false);
        return;
      }

      destroyHls();
      setVideoError(false);
      setLoading(true);

      // Native HLS support (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.load();

        const onLoaded = () => {
          setLoading(false);
          video.play().catch(() => {});
        };
        const onError = () => {
          setVideoError(true);
          setLoading(false);
        };
        video.addEventListener("loadedmetadata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
      } else {
        // Pakai hls.js
        import("hls.js")
          .then(({ default: Hls }) => {
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
              });
              hlsRef.current = hls;
              hls.loadSource(url);
              hls.attachMedia(video);

              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                video.play().catch(() => {});
              });

              hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
                if (data.fatal) {
                  setVideoError(true);
                  setLoading(false);
                }
              });
            } else {
              setVideoError(true);
              setLoading(false);
            }
          })
          .catch(() => {
            setVideoError(true);
            setLoading(false);
          });
      }
    },
    [destroyHls]
  );

  // Initial load
  useEffect(() => {
    setupVideo(streamUrl);
    return () => {
      destroyHls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-setup saat streamUrl berubah (quality switch)
  useEffect(() => {
    if (streamUrl !== initialStreamUrl) {
      setupVideo(streamUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // Handle quality change - fetch new stream URL
  const handleQualityChange = async (newQuality: string) => {
    setSelectedQuality(newQuality);
    setLoading(true);

    try {
      const res = await fetch("/api/drakor/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: drakorId,
          episode: episodeNumber,
          quality: newQuality,
        }),
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      const json = await res.json();
      const playData = json?.data || json;
      const newUrl = playData?.vid_url || playData?.vid_url_proxy || "";

      if (newUrl) {
        setStreamUrl(newUrl);
      } else {
        setVideoError(true);
        setLoading(false);
      }
    } catch (err) {
      console.error("[Quality change] error:", err);
      setVideoError(true);
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 pt-20">
        <button
          onClick={() => router.push(detailHref)}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Detail
        </button>
        <h1 className="mb-4 line-clamp-1 text-lg font-bold sm:text-xl">
          {title} - Episode {episodeNumber}
        </h1>

        {/* Player */}
        <div
          ref={containerRef}
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
          style={{ minHeight: "200px" }}
        >
          {/* Loading overlay dengan fade transition */}
          <div
            className={cn(
              "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black transition-opacity duration-500",
              loading ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-white/70">
              {streamUrl !== initialStreamUrl ? "Mengganti quality..." : "Memuat video..."}
            </p>
          </div>

          {/* Video element */}
          {streamUrl && !videoError ? (
            <video
              ref={videoRef}
              className={cn(
                "h-full w-full transition-opacity duration-500",
                loading ? "opacity-0" : "opacity-100"
              )}
              controls
              playsInline
              onError={() => {
                setVideoError(true);
                setLoading(false);
              }}
            />
          ) : videoError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <p className="mb-1 text-base font-semibold">Playback Error</p>
                <p className="text-sm text-white/60">
                  Video tidak bisa diputar. Coba ganti quality atau pindah episode.
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-12 w-12 text-yellow-500" />
              <div>
                <p className="mb-1 text-base font-semibold">Stream URL tidak tersedia</p>
                <p className="text-sm text-white/60">
                  Episode ini mungkin belum rilis atau sedang error.
                </p>
              </div>
            </div>
          )}

          {/* Settings button (quality selector) */}
          {streamUrl && !videoError && !loading && (
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-primary"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-primary"
                aria-label="Fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Settings panel (quality selector) */}
          {showSettings && !loading && !videoError && (
            <div className="absolute right-3 top-14 z-10 w-40 rounded-lg border border-white/20 bg-black/90 p-3 backdrop-blur-md">
              <p className="mb-2 text-xs font-semibold text-white/80 uppercase tracking-wide">
                Quality
              </p>
              <div className="flex flex-col gap-1">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => {
                      handleQualityChange(q.value);
                      setShowSettings(false);
                    }}
                    className={cn(
                      "rounded px-3 py-1.5 text-left text-xs font-medium transition-colors",
                      selectedQuality === q.value
                        ? "bg-primary text-primary-foreground"
                        : "text-white/70 hover:bg-white/10"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => prevEp && router.push(`${watchBase}/${prevEp.number}`)}
              disabled={!prevEp}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />Prev Episode
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => nextEp && router.push(`${watchBase}/${nextEp.number}`)}
              disabled={!nextEp}
              className="gap-1.5"
            >
              Next Episode<ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quality selector (di luar player, untuk mobile) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Quality:</span>
            <Select value={selectedQuality} onValueChange={handleQualityChange}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            💡 Tips: Jika video tidak otomatis diputar, tekan tombol play di video player.
            Gunakan tombol settings (⚙️) di pojok kanan atas player untuk mengganti quality.
          </p>
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
