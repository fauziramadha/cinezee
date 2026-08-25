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
  Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight,
  Server, Maximize, ExternalLink, Play, List, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DonghuaPlayerProps {
  animeId: string;
  episodeId: string;
  source: "s1" | "s2";
}

function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&#8217;": "'", "&#8216;": "'", "&#8220;": '"', "&#8221;": '"',
    "&#8211;": "-", "&#8212;": "—", "&#8230;": "...", "&amp;": "&",
    "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

export function DonghuaPlayer({ animeId, episodeId, source }: DonghuaPlayerProps) {
  const router = useRouter();
  const [episode, setEpisode] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [streamUrl, setStreamUrl] = useState("");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [showOpenInNewTab, setShowOpenInNewTab] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(true);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [prevEpSlug, setPrevEpSlug] = useState<string | null>(null);
  const [nextEpSlug, setNextEpSlug] = useState<string | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const episodeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setStreamUrl("");
    setIframeLoading(true);
    setIframeError(false);
    setShowOpenInNewTab(false);

    const endpoint = `/api/donghua/episode/${episodeId}`;
    fetch(endpoint)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (!json) throw new Error("Invalid response");
        setEpisode(json);
        const rawStreams = Array.isArray(json.sources) ? json.sources : [];
        const normalizedStreams = rawStreams.map((s: any) => ({
          name: s.name || s.server || "Unknown",
          url: s.url,
        }));
        setStreams(normalizedStreams);
        if (normalizedStreams.length > 0) {
          setSelectedStreamIdx(0);
          setStreamUrl(normalizedStreams[0].url);
          setIframeLoading(false);
        }
        setPrevEpSlug(json.prev_episode || null);
        setNextEpSlug(json.next_episode || null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [episodeId, source]);

  useEffect(() => {
    if (!animeId) return;
    fetch(`/api/donghua/detail/${animeId}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((json) => {
        if (json) {
          setDetail({
            title: decodeHtmlEntities(json.title || ""),
            poster: json.poster || "",
            episodes: Array.isArray(json.episodes) ? json.episodes : [],
          });
        }
      })
      .catch(() => {});
  }, [animeId]);

  useEffect(() => {
    if (showEpisodeList && episodeListRef.current && detail?.episodes?.length) {
      const currentEl = episodeListRef.current.querySelector(`[data-ep="${episodeId}"]`);
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [showEpisodeList, episodeId, detail]);

  useEffect(() => {
    if (!streamUrl || iframeError) return;
    timeoutRef.current = setTimeout(() => {
      if (iframeLoading) { setShowOpenInNewTab(true); setIframeLoading(false); }
    }, 8000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [streamUrl, iframeLoading, iframeError]);

  const handleStreamChange = (idx: number) => {
    setSelectedStreamIdx(idx);
    setStreamUrl(streams[idx].url);
    setIframeLoading(true);
    setIframeError(false);
    setShowOpenInNewTab(false);
  };

  const switchServer = useCallback(() => {
    if (streams.length > 0) handleStreamChange((selectedStreamIdx + 1) % streams.length);
  }, [streams, selectedStreamIdx]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { playerRef.current?.requestFullscreen?.(); }
    else { document.exitFullscreen?.(); }
  };

  const watchBase = `/donghua/s1/watch/${animeId}`;
  const detailHref = `/donghua/s1/${animeId}`;
  const title = episode?.title ? decodeHtmlEntities(episode.title) : "Episode";

  const getEpNum = (ep: any, idx: number): string => {
    const rawValue = String(ep.episode || ep.title || ep.episode_name || "");
    const slugValue = String(ep.slug || "");
    const epMatch = rawValue.match(/episode\s+(\d+)/i);
    if (epMatch) return String(parseInt(epMatch[1], 10));
    const slugMatch = slugValue.match(/episode-(\d+)/i);
    if (slugMatch) return String(parseInt(slugMatch[1], 10));
    const numMatch = rawValue.match(/\d+/);
    if (numMatch) return String(parseInt(numMatch[0], 10));
    return String(idx + 1);
  };

  const sortedEpisodes = (detail?.episodes || []).slice().sort((a: any, b: any) => {
    return parseInt(getEpNum(a, 0)) - parseInt(getEpNum(b, 0));
  });

  const filteredEpisodes = sortedEpisodes.filter((ep: any) => {
    if (!episodeSearch.trim()) return true;
    const num = getEpNum(ep, 0);
    return num.includes(episodeSearch.trim());
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-black">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
              <div className="absolute inset-0 rounded-full border-2 border-t-red-600 animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-white/60">Memuat episode...</p>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  if (error || !episode) {
    return (
      <main className="min-h-screen bg-black">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-red-400">{error || "Tidak ditemukan"}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push(detailHref)} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />Kembali ke Detail
          </Button>
        </div>
        <Footer />
      </main>
    );
  }

  const renderEpisodeList = (isMobile: boolean) => {
    if (!detail?.episodes?.length) return null;
    return (
      <div className={cn("rounded-lg border border-white/10 bg-zinc-900 p-4", isMobile && "lg:hidden")}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <List className="h-4 w-4 text-red-500" />
            Daftar Episode ({sortedEpisodes.length})
          </h3>
        </div>
        {sortedEpisodes.length > 10 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              type="text"
              placeholder="Cari episode..."
              value={episodeSearch}
              onChange={(e) => setEpisodeSearch(e.target.value)}
              className="border-white/10 bg-black/40 pl-9 text-white placeholder:text-white/30"
            />
          </div>
        )}
        <div ref={episodeListRef} className={cn("space-y-1.5 overflow-y-auto pr-1", isMobile ? "max-h-96" : "max-h-[60vh]")}>
          {filteredEpisodes.map((ep: any, idx: number) => {
            const epNum = getEpNum(ep, idx);
            const epSlug = ep.slug || ep.episodeId || "";
            const isCurrent = epSlug === episodeId;
            return (
              <button
                key={epSlug || idx}
                data-ep={epSlug}
                onClick={() => router.push(`${watchBase}/${epSlug}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition",
                  isCurrent
                    ? "border-red-500 bg-red-600/10"
                    : "border-white/10 bg-black/40 hover:border-white/30 hover:bg-white/5"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isCurrent ? "bg-red-600 text-white" : "bg-white/10 text-white/60"
                )}>
                  {epNum}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-white" : "text-white/70"
                  )}>
                    Episode {epNum}
                  </p>
                </div>
                {isCurrent && (
                  <Play className="h-4 w-4 shrink-0 fill-red-500 text-red-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-6 pt-20 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push(detailHref)}
            className="flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Kembali ke Detail</span>
          </button>
        </div>

        <h1 className="mb-4 line-clamp-1 text-lg font-bold text-white sm:text-xl md:text-2xl">
          {title}
        </h1>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div
              ref={playerRef}
              className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
              style={{ minHeight: "200px" }}
            >
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                  <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                  <p className="text-sm text-white/70">Loading video...</p>
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
                    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
                  }}
                  onError={() => { setIframeError(true); setIframeLoading(false); }}
                  title={title}
                />
              )}
              {iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <div>
                    <p className="mb-1 text-base font-semibold">Playback Error</p>
                    <p className="text-sm text-white/60">Coba server lain.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={switchServer} size="sm" className="gap-2">
                      <Server className="h-3.5 w-3.5" />Server Lain
                    </Button>
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
                      className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />Tab Baru
                    </a>
                    <Button onClick={switchServer} size="sm" variant="outline" className="gap-2">
                      <Server className="h-3.5 w-3.5" />Server Lain
                    </Button>
                  </div>
                </div>
              )}
              {!iframeLoading && !iframeError && !showOpenInNewTab && (
                <button
                  onClick={toggleFullscreen}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-red-600"
                  aria-label="Fullscreen"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => prevEpSlug && router.push(`${watchBase}/${prevEpSlug}`)}
                  disabled={!prevEpSlug}
                  className="gap-1.5 border-white/20 text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => nextEpSlug && router.push(`${watchBase}/${nextEpSlug}`)}
                  disabled={!nextEpSlug}
                  className="gap-1.5 border-white/20 text-white hover:bg-white/10"
                >
                  Next<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEpisodeList(!showEpisodeList)}
                className="gap-1.5 border-white/20 text-white hover:bg-white/10 lg:hidden"
              >
                <List className="h-4 w-4" />
                {showEpisodeList ? "Sembunyikan" : "Tampilkan"} Episode
              </Button>
            </div>

            {streams.length > 0 && (
              <div className="mt-4 rounded-lg border border-white/10 bg-zinc-900 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Server className="h-4 w-4 text-red-500" />
                  Pilih Server
                </h3>
                <div className="flex flex-wrap gap-2">
                  {streams.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStreamChange(idx)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                        idx === selectedStreamIdx
                          ? "bg-red-600 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-white/40">
                  💡 Kalau video tidak muncul, coba server lain.
                </p>
              </div>
            )}

            {showEpisodeList && renderEpisodeList(true)}
          </div>

          <div className="hidden w-80 shrink-0 lg:block">
            <div className="sticky top-20">
              {renderEpisodeList(false)}
            </div>
          </div>
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
