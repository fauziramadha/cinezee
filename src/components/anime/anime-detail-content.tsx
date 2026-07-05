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
  title?: string | number;
  name?: string;
  eps?: number;
  date?: string;
  episodeId?: string;
  slug?: string;
  href?: string;
}

interface GenreItem {
  title?: string;
  name?: string;
  genreId?: string;
  slug?: string;
  href?: string;
}

interface AnimeDetail {
  title: string;
  poster?: string;
  japanese?: string;
  english?: string;
  synonym?: string;
  score?: string | { value?: string; users?: string };
  rating?: string;
  producers?: string;
  author?: string;
  type?: string;
  status?: string;
  episodes?: number | null;
  duration?: string;
  aired?: string;
  studios?: string;
  studio?: string;
  season?: string;
  batch?: string | null;
  batchList?: any[];
  batches?: any[];
  synopsis?: string | { paragraphs?: string[]; connections?: string[] };
  genres?: GenreItem[];
  genreList?: GenreItem[];
  episodeList?: EpisodeItem[];
  episodes?: EpisodeItem[]; // Animasu pakai "episodes"
  trailer?: string;
  source?: string;
}

interface AnimeDetailContentProps {
  animeId: string;
  source?: "otakudesu" | "animasu";
}

export function AnimeDetailContent({
  animeId,
  source = "otakudesu",
}: AnimeDetailContentProps) {
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

    const detailEndpoint =
      source === "animasu"
        ? `/api/anime/animasu/detail/${animeId}`
        : `/api/anime/anime/${animeId}`;

    fetch(detailEndpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        // Animasu: data.detail, Otakudesu: data
        const rawData = source === "animasu" ? json?.data?.detail : json?.data;
        if (rawData) {
          const data = { ...rawData } as AnimeDetail;
          // Fallback title
          if (!data.title) {
            data.title =
              data.english || data.japanese || data.synonym || animeId.replace(/-/g, " ");
          }
          setDetail(data);
        } else {
          throw new Error("Invalid response");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [animeId, source]);

  // === Load batch download ===
  const handleLoadBatch = async () => {
    // Animasu: batches[] sudah ada di detail
    if (source === "animasu") {
      if (detail?.batches && detail.batches.length > 0) {
        setBatchData({ downloadList: detail.batches });
      } else {
        setBatchData({ error: "Batch tidak tersedia untuk anime ini" });
      }
      setShowBatch(true);
      return;
    }

    // Otakudesu: fetch terpisah
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

  // === Helper: build watch URL ===
  const buildWatchUrl = (episodeId: string) => {
    return source === "animasu"
      ? `/anime/s2/watch/${animeId}/${episodeId}`
      : `/anime/s1/watch/${animeId}/${episodeId}`;
  };

  // === Helper: build genre URL ===
  const buildGenreUrl = (genreId: string) => {
    return source === "animasu"
      ? `/anime/s2/genre/${genreId}`
      : `/anime/s1/genre/${genreId}`;
  };

  // === Helper: get episode ID (handle both structures) ===
  const getEpisodeId = (ep: EpisodeItem): string => {
    return ep.episodeId || ep.slug || "";
  };

  // === Helper: get episode label ===
  const getEpisodeLabel = (ep: EpisodeItem, idx: number): string => {
    if (typeof ep.eps === "number") return String(ep.eps);
    if (typeof ep.title === "number") return String(ep.title);
    // Animasu: ep.name = "Episode 1", extract number
    if (ep.name) {
      const match = ep.name.match(/\d+/);
      if (match) return match[0];
    }
    return String(idx + 1);
  };

  // === Helper: get genre info ===
  const getGenreInfo = (g: GenreItem): { title: string; id: string } => {
    return {
      title: g.title || g.name || "Unknown",
      id: g.genreId || g.slug || "",
    };
  };

  // === Normalize episode list ===
  const episodeList: EpisodeItem[] = detail?.episodeList || detail?.episodes || [];

  // === Normalize genre list ===
  const genreList: GenreItem[] = detail?.genreList || detail?.genres || [];

  // === Normalize synopsis ===
  const synopsisParagraphs: string[] = (() => {
    if (!detail?.synopsis) return [];
    if (typeof detail.synopsis === "string") {
      return detail.synopsis.split("\n").filter((p) => p.trim());
    }
    return detail.synopsis.paragraphs || [];
  })();

  // === Normalize score ===
  const scoreValue = (() => {
    if (typeof detail?.score === "object") return detail.score?.value;
    if (typeof detail?.score === "string") return detail.score;
    if (detail?.rating) return detail.rating;
    return undefined;
  })();

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
  const episodeCount = (detail.episodes as unknown as number) || episodeList.length || 0;
  const studioName = detail.studios || detail.studio;

  // Cek apakah ada batch
  const hasBatch =
    source === "animasu"
      ? !!(detail.batches && detail.batches.length > 0)
      : !!detail.batch;

  // Episode pertama
  const firstEpisode =
    source === "animasu"
      ? episodeList[0]
      : episodeList[episodeList.length - 1];

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

        {/* Source badge */}
        <div className="mb-3">
          <span
            className={cn(
              "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              source === "animasu"
                ? "bg-purple-500/90 text-white"
                : "bg-blue-500/90 text-white"
            )}
          >
            {source === "animasu" ? "Server 2" : "Server 1"}
          </span>
        </div>

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
            {detail.english && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.english}
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
              {scoreValue && scoreValue !== "N/A" && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {scoreValue}
                </Badge>
              )}
              {detail.duration && detail.duration !== "Unknown" && (
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
              {firstEpisode && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(buildWatchUrl(getEpisodeId(firstEpisode)))
                  }
                  className="gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Tonton Episode 1
                </Button>
              )}

              {hasBatch && (
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
              <div className="space-y-3">
                {batchData.downloadList.map((dl: any, idx: number) => {
                  const qualityLabel =
                    dl.quality || dl.resolution || dl.size || dl.title || "Download";
                  const titleLabel = dl.title || dl.name || "";
                  const downloadLinks =
                    dl.links || dl.downloadLinks || dl.urls || dl.mirrors || [];
                  return (
                    <div key={idx} className="rounded border border-border p-3 text-xs">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {qualityLabel}
                        </Badge>
                        {titleLabel && (
                          <span className="min-w-0 truncate text-muted-foreground">
                            {titleLabel}
                          </span>
                        )}
                      </div>
                      {downloadLinks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {downloadLinks.map((link: any, lidx: number) => (
                            <a
                              key={lidx}
                              href={link.url || link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-primary/10 px-3 py-1.5 font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                              {link.host || link.title || `Link ${lidx + 1}`}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          Tidak ada link download untuk quality ini.
                        </p>
                      )}
                    </div>
                  );
                })}
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
            {genreList.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Genre
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {genreList.map((g, idx) => {
                    const info = getGenreInfo(g);
                    return (
                      <Link key={info.id || idx} href={buildGenreUrl(info.id)}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:border-primary hover:text-primary"
                        >
                          {info.title}
                        </Badge>
                      </Link>
                    );
                  })}
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
            {episodeList.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Episode ({episodeList.length})
                </h3>
                <div className="space-y-1.5">
                  {episodeList.map((ep, idx) => {
                    const epId = getEpisodeId(ep);
                    const epLabel = getEpisodeLabel(ep, idx);
                    return (
                      <Link
                        key={epId || idx}
                        href={buildWatchUrl(epId)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {epLabel}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              Episode {epLabel}
                            </p>
                            {ep.date && (
                              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="h-2.5 w-2.5" />
                                {ep.date}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
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
                {episodeCount > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Total Episode</dt>
                    <dd className="font-medium">{episodeCount}</dd>
                  </div>
                )}
                {detail.duration && detail.duration !== "Unknown" && (
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
                {studioName && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Studio</dt>
                    <dd className="text-right font-medium">{studioName}</dd>
                  </div>
                )}
                {detail.producers && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Produser</dt>
                    <dd className="text-right font-medium">{detail.producers}</dd>
                  </div>
                )}
                {detail.season && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Musim</dt>
                    <dd className="font-medium">{detail.season}</dd>
                  </div>
                )}
                {detail.author && detail.author !== "N/A" && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Author</dt>
                    <dd className="font-medium">{detail.author}</dd>
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
