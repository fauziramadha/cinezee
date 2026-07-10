"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DrakorPlayerViewProps {
  drakorId: string;
  episodeNumber: string;
  streamUrl: string;
  detail: any;
}

export function DrakorPlayerView({
  drakorId,
  episodeNumber,
  streamUrl,
  detail,
}: DrakorPlayerViewProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);

  const title = detail?.title || "Drakor";
  const episodes = Array.isArray(detail?.episodes) ? detail.episodes : [];
  const watchBase = `/drakor/watch/${drakorId}`;
  const detailHref = `/drakor/${drakorId}`;

  // Cari episode prev/next
  const currentEpNum = parseInt(episodeNumber, 10);
  const prevEp = episodes.find((e: any) => e?.number === currentEpNum - 1);
  const nextEp = episodes.find((e: any) => e?.number === currentEpNum + 1);

  // Setup HLS playback (cross-browser)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setLoading(false);
      return;
    }

    let hls: any = null;

    // Cek apakah browser support HLS native (iPhone Safari, Mac Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support - pakai langsung
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        // Auto-play (muted untuk bypass autoplay policy di beberapa browser)
        video.play().catch(() => {
          // Autoplay diblokir, user harus klik play manual
        });
      });
      video.addEventListener("error", () => {
        setVideoError(true);
        setLoading(false);
      });
    } else {
      // Browser tidak support native HLS (Android Chrome, Desktop Chrome/Firefox)
      // Pakai hls.js
      import("hls.js")
        .then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            hls = new Hls({
              // Konfigurasi untuk stabilitas
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setLoading(false);
              video.play().catch(() => {
                // Autoplay diblokir
              });
            });

            hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                console.error("[HLS] Fatal error:", data);
                setVideoError(true);
                setLoading(false);
              }
            });
          } else {
            // Browser tidak support HLS sama sekali
            setVideoError(true);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("[HLS] Failed to load hls.js:", err);
          setVideoError(true);
          setLoading(false);
        });
    }

    // Cleanup
    return () => {
      if (hls) {
        hls.destroy();
      }
      if (video) {
        video.removeEventListener("loadedmetadata", () => {});
        video.removeEventListener("error", () => {});
      }
    };
  }, [streamUrl]);

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
          {/* Loading overlay */}
          {loading && !videoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Memuat video...</p>
            </div>
          )}

          {streamUrl && !videoError ? (
            <video
              ref={videoRef}
              className="h-full w-full"
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
                  Video tidak bisa diputar. Coba buka di tab baru atau pindah episode.
                </p>
              </div>
              {streamUrl && (
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka di Tab Baru
                </a>
              )}
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

          {/* Fullscreen button */}
          {streamUrl && !videoError && !loading && (
            <button
              onClick={toggleFullscreen}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-primary"
            >
              <Maximize className="h-4 w-4" />
            </button>
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
          {streamUrl && (
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka Stream di Tab Baru
            </a>
          )}
        </div>

        {/* Info note */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            💡 Tips: Jika mengalami kendala silahkan hubungi admin.
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
