"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  Play,
  Calendar,
  Clock,
  Tv,
  Star,
  Download,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EpisodeItem {
  title: string;
  eps: number;
  date: string;
  episodeId: string;
  href: string;
}

interface GenreItem {
  title: string;
  genreId: string;
  href: string;
}

interface AnimeDetail {
  title: string;
  poster?: string;
  japanese?: string;
  score?: string;
  producers?: string;
  type?: string;
  status?: string;
  episodes?: number | null;
  duration?: string;
  aired?: string;
  studios?: string;
  batch?: string | null;
  synopsis?: {
    paragraphs?: string[];
    connections?: string[];
  };
  genreList?: GenreItem[];
  episodeList?: EpisodeItem[];
}

interface AnimeDetailContentProps {
  animeId: string;
}

export function AnimeDetailContent({ animeId }: AnimeDetailContentProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<any>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatch, setShowBatch] = useState(false);

  // === Load detail anime ===
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/anime/anime/${animeId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.data) {
          setDetail(json.data);
        } else {
          throw new Error("Invalid response");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [animeId]);

  // === Load batch download (lazy, hanya saat tombol diklik) ===
  const handleLoadBatch = async () => {
    if (batchData) {
      setShowBatch(!showBatch);
      return;
    }

    setBatchLoading(true);
    try {
      const res = await fetch(`/api/anime/batch/${animeId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setBatchData(json?.data || null);
      setShowBatch(true);
    } catch {
      setBatchData({ error: "Batch tidak tersedia untuk anime ini" });
      setShowBatch(true);
    } finally {
      setBatchLoading(false);
    }
  };

  // === Loading state ===
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

  // === Error state ===
  if (error || !detail) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">
            {error || "Anime tidak ditemukan"}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push("/anime")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Anime
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

  const title = detail.title || "Untitled";
  const poster = detail.poster || null;
  const status = detail.status || "Unknown";
  const isOngoing = status.toLowerCase().includes("ongoing");
  const episodeCount = detail.episodes || detail.episodeList?.length || 0;
  const synopsisParagraphs = detail.synopsis?.paragraphs || [];

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* === Hero Section === */}
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted sm:h-[50vh]">
        {poster && (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="100vw"
            className="object-cover opacity-30 blur-sm scale-110"
            unoptimized
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>

      <div className="container mx-auto -mt-32 px-4 pb-12 sm:-mt-40">
        {/* === Back button === */}
        <button
          onClick={() => router.push("/anime")}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Anime
        </button>

        {/* === Hero content: poster + info === */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          {/* Poster */}
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-56">
            {poster ? (
              <Image
                src={poster}
                alt={title}
                fill
                sizes="(max-width: 640px) 160px, 224px"
                className="object-cover"
                unoptimized
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Tv className="h-12 w-12" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              {title}
            </h1>
            {detail.japanese && (
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.japanese}
              </p>
            )}

            {/* Quick info badges */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {detail.type && (
                <Badge variant="secondary" className="gap-1">
                  <Tv className="h-3 w-3" />
                  {detail.type}
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={cn(
                  isOngoing
                    ? "border-green-500/40 text-green-400"
                    : "border-blue-500/40 text-blue-400"
                )}
              >
                {status}
              </Badge>
              {detail.score && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {detail.score}
                </Badge>
              )}
              {detail.duration && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {detail.duration}
                </Badge>
              )}
              {episodeCount > 0 && (
                <Badge variant="secondary">{episodeCount} Episode</Badge>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {detail.episodeList && detail.episodeList.length > 0 && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/anime/watch/${animeId}/${detail.episodeList![detail.episodeList!.length - 1].episodeId}`
                    )
                  }
                  className="gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Tonton Episode 1
                </Button>
              )}

              {detail.batch && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadBatch}
                  disabled={batchLoading}
                  className="gap-2"
                >
                  {batchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download Batch
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* === Batch download modal === */}
        {showBatch && batchData && (
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Download className="h-4 w-4 text-primary" />
                Link Download Batch
              </h3>
              <button
                onClick={() => setShowBatch(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Tutup
              </button>
            </div>
            {batchData.error ? (
              <p className="text-sm text-muted-foreground">{batchData.error}</p>
            ) : batchData?.downloadList?.length > 0 ? (
              <div className="space-y-2">
                {batchData.downloadList.map((dl: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs"
                  >
                    <Badge variant="outline">{dl.quality || "Unknown"}</Badge>
                    {dl.links?.map((link: any, lidx: number) => (
                      <a
                        key={lidx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-primary/10 px-2 py-1 font-medium text-primary hover:bg-primary/20"
                      >
                        {link.host || "Download"}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Batch tidak tersedia untuk anime ini.
              </p>
            )}
          </div>
        )}

        {/* === Content grid === */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {/* Left: Synopsis + Episodes */}
          <div className="md:col-span-2">
            {/* Genres */}
            {detail.genreList && detail.genreList.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Genre
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detail.genreList.map((g) => (
                    <Link key={g.genreId} href={`/anime/genre/${g.genreId}`}>
                      <Badge variant="outline" className="cursor-pointer hover:border-primary hover:text-primary">
                        {g.title}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Synopsis */}
            {synopsisParagraphs.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Synopsis
                </h3>
                <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
                  {synopsisParagraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Episode list */}
            {detail.episodeList && detail.episodeList.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Episode ({detail.episodeList.length})
                </h3>
                <div className="space-y-1.5">
                  {detail.episodeList.map((ep) => (
                    <Link
                      key={ep.episodeId}
                      href={`/anime/watch/${animeId}/${ep.episodeId}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {ep.eps}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            Episode {ep.eps}
                          </p>
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            {ep.date}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Info sidebar */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informasi
              </h3>
              <dl className="space-y-2 text-xs">
                {detail.type && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tipe</dt>
                    <dd className="font-medium">{detail.type}</dd>
                  </div>
                )}
                {detail.status && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">{detail.status}</dd>
                  </div>
                )}
                {detail.episodes && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Total Episode</dt>
                    <dd className="font-medium">{detail.episodes}</dd>
                  </div>
                )}
                {detail.duration && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Durasi</dt>
                    <dd className="font-medium">{detail.duration}</dd>
                  </div>
                )}
                {detail.aired && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Tayang</dt>
                    <dd className="font-medium">{detail.aired}</dd>
                  </div>
                )}
                {detail.studios && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Studio</dt>
                    <dd className="text-right font-medium">{detail.studios}</dd>
                  </div>
                )}
                {detail.producers && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Produser</dt>
                    <dd className="text-right font-medium">{detail.producers}</dd>
                  </div>
                )}
              </dl>
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
