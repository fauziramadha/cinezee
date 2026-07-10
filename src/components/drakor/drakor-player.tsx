"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Server, Download, X, Maximize, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DrakorPlayerProps {
  drakorId: string;
  episodeNumber: string;
}

export function DrakorPlayer({ drakorId, episodeNumber }: DrakorPlayerProps) {
  const router = useRouter();
  const [streamData, setStreamData] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [qualities, setQualities] = useState<any[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [showOpenInNewTab, setShowOpenInNewTab] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setStreamUrl("");
    setIframeLoading(true);
    setIframeError(false);
    setShowOpenInNewTab(false);

    const fetchAll = async () => {
      try {
        // Fetch detail + stream URL in parallel
        const [detailRes, playRes] = await Promise.all([
          fetch("/api/drakor/detail/" + drakorId).then((r) => r.json()),
          fetch("/api/drakor/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: drakorId, episode: episodeNumber }),
          }).then((r) => r.json()),
        ]);

        // Parse detail
        const detailRaw = detailRes?.data || detailRes;
        if (detailRaw) setDetail(detailRaw);

        // Parse play response
        // Shape bisa berbeda, kita defensive
        const playRaw = playRes?.data || playRes;
        if (playRaw) {
          setStreamData(playRaw);
          // Cari stream URL dan qualities
          const streams = playRaw.streams || playRaw.qualities || playRaw.sources || [];
          if (Array.isArray(streams) && streams.length > 0) {
            setQualities(streams);
            setSelectedQuality(0);
            const firstStream = streams[0];
            const url = firstStream.url || firstStream.src || firstStream.link || "";
            setStreamUrl(url);
            setIframeLoading(false);
          } else if (playRaw.url || playRaw.src || playRaw.link || playRaw.streamUrl) {
            // Single stream URL
            const url = playRaw.url || playRaw.src || playRaw.link || playRaw.streamUrl;
            setStreamUrl(url);
            setIframeLoading(false);
          } else {
            // Tidak ada stream URL
            setIframeError(true);
            setIframeLoading(false);
          }
        } else {
          setIframeError(true);
          setIframeLoading(false);
        }
      } catch (err) {
        console.error("[DrakorPlayer] error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [drakorId, episodeNumber]);

  // Timeout untuk iframe
  useEffect(() => {
    if (!streamUrl || iframeError) return;
    timeoutRef.current = setTimeout(() => {
      if (iframeLoading) {
        setShowOpenInNewTab(true);
        setIframeLoading(false);
      }
    }, 8000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [streamUrl, iframeLoading, iframeError]);

  const handleQualityChange = (idx: number) => {
    setSelectedQuality(idx);
    const url = qualities[idx]?.url || qualities[idx]?.src || qualities[idx]?.link || "";
    setStreamUrl(url);
    setIframeLoading(true);
    setIframeError(false);
    setShowOpenInNewTab(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const title = detail?.title || "Drakor";
  const episodes = detail?.episodes || [];
  const watchBase = `/drakor/watch/${drakorId}`;
  const detailHref = `/drakor/${drakorId}`;

  // Cari episode prev/next
  const currentEpNum = parseInt(episodeNumber, 10);
  const prevEp = episodes.find((e: any) => e.number === currentEpNum - 1);
  const nextEp = episodes.find((e: any) => e.number === currentEpNum + 1);

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

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push(detailHref)} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />Kembali
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

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 pt-20">
        <button onClick={() => router.push(detailHref)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kembali ke Detail
        </button>
        <h1 className="mb-4 line-clamp-1 text-lg font-bold sm:text-xl">
          {title} - Episode {episodeNumber}
        </h1>

        {/* Player */}
        <div ref={playerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black" style={{ minHeight: "200px" }}>
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-white/70">Loading...</p>
            </div>
          )}

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
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
              }}
              onError={() => {
                setIframeError(true);
                setIframeLoading(false);
              }}
              title={title}
            />
          )}

          {iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <p className="mb-1 text-base font-semibold">Playback Error</p>
                <p className="text-sm text-white/60">Coba server lain atau buka di tab baru.</p>
              </div>
              <div className="flex gap-2">
                {streamUrl && (
                  <a
                    href={streamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />Tab Baru
                  </a>
                )}
              </div>
            </div>
          )}

          {showOpenInNewTab && streamUrl && !iframeError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
              <AlertCircle className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="mb-1 text-sm font-semibold">Video tidak bisa di-embed</p>
                <p className="text-xs text-white/60">Buka di tab baru.</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />Tab Baru
                </a>
              </div>
            </div>
          )}

          {!iframeLoading && !iframeError && !showOpenInNewTab && (
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
              <ChevronLeft className="h-4 w-4" />Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => nextEp && router.push(`${watchBase}/${nextEp.number}`)}
              disabled={!nextEp}
              className="gap-1.5"
            >
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quality selector */}
        {qualities.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" />Pilih Quality
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Quality:</span>
              <Select value={String(selectedQuality)} onValueChange={(v) => handleQualityChange(parseInt(v, 10))}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {qualities.map((q, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {q.quality || q.label || q.name || `Quality ${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Kalau video tidak muncul, coba quality lain atau buka di tab baru.
            </p>
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
