"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, ExternalLink, AlertCircle } from "lucide-react";
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

  const title = detail?.title || "Drakor";
  const episodes = Array.isArray(detail?.episodes) ? detail.episodes : [];
  const watchBase = `/drakor/watch/${drakorId}`;
  const detailHref = `/drakor/${drakorId}`;

  // Cari episode prev/next
  const currentEpNum = parseInt(episodeNumber, 10);
  const prevEp = episodes.find((e: any) => e?.number === currentEpNum - 1);
  const nextEp = episodes.find((e: any) => e?.number === currentEpNum + 1);

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
          {streamUrl && !videoError ? (
            <video
              ref={videoRef}
              src={streamUrl}
              className="h-full w-full"
              controls
              playsInline
              autoPlay
              onError={() => setVideoError(true)}
            >
              Browser Anda tidak mendukung pemutaran video.
            </video>
          ) : videoError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <p className="mb-1 text-base font-semibold">Playback Error</p>
                <p className="text-sm text-white/60">
                  Video tidak bisa diputar di browser ini. Coba buka di tab baru.
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
          {streamUrl && !videoError && (
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
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Buka Stream di Tab Baru
          </a>
        </div>

        {/* Info note */}
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            💡 Tips: Jika video tidak otomatis diputar, tekan tombol play di video player.
            Video menggunakan format HLS (m3u8) yang didukung native oleh Safari iPhone.
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
