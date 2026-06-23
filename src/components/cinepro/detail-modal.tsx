"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  Play,
  X,
  Star,
  Calendar,
  Clock,
  Loader2,
  Bookmark,
  Check,
  Share2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { getImageUrl, type MovieDetail } from "@/lib/tmdb";
import { MovieCard } from "./movie-card";
import { toast } from "sonner";

export function DetailModal() {
  const { selectedMedia, setSelectedMedia, openPlayer, addToHistory, setAuthModalOpen } = useAppStore();
  const { data: session, status } = useSession();
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Fetch detail when media is selected
  useEffect(() => {
    if (!selectedMedia) {
      Promise.resolve().then(() => {
        setDetail(null);
        setError(null);
        setInWatchlist(false);
      });
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/detail/${selectedMedia.id}?type=${selectedMedia.type}`,
        );
        if (!res.ok) throw new Error("Failed to load");
        const data: MovieDetail = await res.json();
        if (cancelled) return;
        setDetail(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDetail();

    // Check if already in watchlist (only if logged in)
    if (status === "authenticated" && session?.user) {
      fetch("/api/watchlist")
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const exists = data.watchlist?.some(
            (item: any) =>
              item.mediaId === selectedMedia.id &&
              item.mediaType === selectedMedia.type,
          );
          setInWatchlist(!!exists);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [selectedMedia, session, status]);

  const handleOpen = () => {
    if (!selectedMedia) return;
    addToHistory({
      ...selectedMedia,
      watchedAt: new Date().toISOString(),
    });
    openPlayer(selectedMedia);
  };

  const handleToggleWatchlist = async () => {
    if (!selectedMedia || !detail) return;

    // If not logged in, open auth modal
    if (status !== "authenticated" || !session?.user) {
      setAuthModalOpen(true);
      toast.info("Silakan login dulu untuk menyimpan ke watchlist");
      return;
    }

    setWatchlistLoading(true);

    try {
      if (inWatchlist) {
        // Find the watchlist item ID to delete
        const listRes = await fetch("/api/watchlist");
        const listData = await listRes.json();
        const item = listData.watchlist?.find(
          (i: any) =>
            i.mediaId === selectedMedia.id &&
            i.mediaType === selectedMedia.type,
        );

        if (item) {
          const res = await fetch(`/api/watchlist?id=${item.id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setInWatchlist(false);
            toast.success("Dihapus dari watchlist");
          }
        }
      } else {
        // Add to watchlist
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId: selectedMedia.id,
            mediaType: selectedMedia.type,
            title: detail.title || detail.name || selectedMedia.title,
            posterPath: detail.poster_path,
            backdropPath: detail.backdrop_path,
          }),
        });

        if (res.ok) {
          setInWatchlist(true);
          toast.success("Ditambahkan ke watchlist");
        } else {
          const data = await res.json();
          if (data.error === "Already in watchlist") {
            setInWatchlist(true);
            toast.info("Sudah ada di watchlist");
          } else {
            toast.error(data.error || "Gagal menambahkan ke watchlist");
          }
        }
      }
    } catch (error) {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!selectedMedia) return null;

  const title = detail?.title || detail?.name || selectedMedia.title;
  const year = (detail?.release_date || detail?.first_air_date || "").split("-")[0];
  const rating = detail?.vote_average?.toFixed(1) || "N/A";
  const runtime = detail?.runtime || detail?.episode_run_time?.[0];
  const director = detail?.credits?.crew?.find((c) => c.job === "Director")?.name;
  const creator = detail?.created_by?.[0]?.name;
  const cast = detail?.credits?.cast?.slice(0, 8) || [];
  const trailer = detail?.videos?.results?.find(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );
  const similar = detail?.recommendations?.results?.slice(0, 12) || [];

  return (
    <Dialog
      open={!!selectedMedia}
      onOpenChange={(open) => {
        if (!open) setSelectedMedia(null);
      }}
    >
      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-hidden p-0 sm:max-w-2xl md:max-w-4xl lg:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <button
          onClick={() => setSelectedMedia(null)}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <ScrollArea className="max-h-[95vh]">
          {loading && (
            <div className="flex h-96 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && !loading && (
            <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedMedia(null)}
              >
                Go back
              </Button>
            </div>
          )}

          {detail && !loading && !error && (
            <div className="fade-in">
              {/* Hero section with backdrop */}
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {detail.backdrop_path && (
                  <Image
                    src={getImageUrl(detail.backdrop_path, "original")}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 1024px"
                    className="object-cover"
                    unoptimized
                    priority
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                  <Badge className="mb-2 bg-primary text-primary-foreground">
                    {selectedMedia.type === "tv" ? "TV Series" : "Movie"}
                  </Badge>
                  <h2 className="text-xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-2xl md:text-4xl">
                    {title}
                  </h2>
                  {detail.tagline && (
                    <p className="mt-1 text-xs italic text-white/80 sm:text-sm">
                      &quot;{detail.tagline}&quot;
                    </p>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/50 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 md:px-8">
                <Button
                  size="lg"
                  onClick={handleOpen}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
                  Play Now
                </Button>
                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="lg" variant="secondary" className="gap-2">
                      <Play className="h-4 w-4" />
                      Trailer
                    </Button>
                  </a>
                )}
                {/* Watchlist toggle button */}
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleToggleWatchlist}
                  disabled={watchlistLoading}
                  aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                  className={inWatchlist ? "border-primary text-primary" : ""}
                >
                  {watchlistLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : inWatchlist ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </Button>
                <Button size="icon" variant="outline" aria-label="Share">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Content grid */}
              <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 md:grid-cols-3 md:p-8">
                {/* Left column */}
                <div className="md:col-span-2">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs sm:mb-4 sm:gap-3 sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 sm:h-4 sm:w-4" />
                      <span className="font-semibold">{rating}</span>
                      <span className="text-muted-foreground">
                        ({detail.vote_count?.toLocaleString()})
                      </span>
                    </span>
                    {year && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {year}
                      </span>
                    )}
                    {runtime && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {runtime}m
                      </span>
                    )}
                    {detail.status && (
                      <Badge variant="secondary" className="text-xs">
                        {detail.status}
                      </Badge>
                    )}
                  </div>

                  {detail.genres && detail.genres.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5 sm:mb-4">
                      {detail.genres.map((genre) => (
                        <Badge key={genre.id} variant="outline" className="text-xs">
                          {genre.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-sm">
                    Overview
                  </h3>
                  <p className="text-xs leading-relaxed text-foreground/90 sm:text-sm md:text-base">
                    {detail.overview || "No overview available."}
                  </p>

                  {cast.length > 0 && (
                    <div className="mt-4 sm:mt-6">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-sm">
                        Top Cast
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                        {cast.map((person) => (
                          <div key={person.id} className="flex items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted sm:h-12 sm:w-12">
                              {person.profile_path ? (
                                <Image
                                  src={getImageUrl(person.profile_path, "w185")}
                                  alt={person.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium sm:text-sm">
                                {person.name}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                                {person.character}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="space-y-3 sm:space-y-4">
                  {(director || creator) && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {selectedMedia.type === "tv" ? "Creator" : "Director"}
                      </h4>
                      <p className="mt-0.5 text-xs sm:text-sm">{director || creator}</p>
                    </div>
                  )}

                  {selectedMedia.type === "tv" && detail.number_of_seasons && (
                    <div className="flex gap-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Seasons
                        </h4>
                        <p className="mt-0.5 text-xs sm:text-sm">{detail.number_of_seasons}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Episodes
                        </h4>
                        <p className="mt-0.5 text-xs sm:text-sm">{detail.number_of_episodes}</p>
                      </div>
                    </div>
                  )}

                  {detail.spoken_languages && detail.spoken_languages.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Languages
                      </h4>
                      <p className="mt-0.5 text-xs sm:text-sm">
                        {detail.spoken_languages.map((l) => l.english_name).join(", ")}
                      </p>
                    </div>
                  )}

                  {detail.production_companies && detail.production_companies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Production
                      </h4>
                      <p className="mt-0.5 text-xs sm:text-sm">
                        {detail.production_companies.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Similar / Recommendations */}
              {similar.length > 0 && (
                <div className="border-t border-border px-4 py-4 sm:px-6 sm:py-6 md:px-8">
                  <h3 className="mb-3 text-sm font-bold sm:mb-4 sm:text-base">
                    More Like This
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                    {similar.map((movie) => (
                      <MovieCard key={`sim-${movie.id}`} movie={movie} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
