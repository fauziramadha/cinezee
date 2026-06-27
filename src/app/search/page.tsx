"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Search, ArrowLeft, Film, Tv, Loader2, Filter, X } from "lucide-react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { Button } from "@/components/ui/button";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/utils";

// ============================================================
// NETWORK DATA (sama dengan di search-modal)
// ============================================================
const NETWORKS: Record<number, { name: string; logo_path: string }> = {
  213: { name: "Netflix", logo_path: "/wwemzKWzjKYJFfCeiB57q3r4Vcm.png" },
  1024: { name: "Prime Video", logo_path: "/hwqYUQmqiyA6tLnqj8MP9ey6ePh.png" },
  2739: { name: "Disney+", logo_path: "/gJ8VX6JSu3ci8HuqfVfGggHgz9m.png" },
  2552: { name: "Apple TV+", logo_path: "/4ec1mK0kCjQzdQ8jyDjsLnQR5Ip.png" },
  49: { name: "HBO", logo_path: "/tuomPhY2UtuPTqqFnqfVfGggHgz9m.png" },
  283: { name: "Hulu", logo_path: "/pqUTCyXDRTmCxHa1RfFtB6S9t8O.png" },
  3353: { name: "Peacock", logo_path: "/qZNmL9QV3ijn3sHg5jPqYy7jPrc.png" },
  4330: { name: "Paramount+", logo_path: "/dhfmsl5LCpsHEyAhuJoCqMAdN9b.png" },
};

// ============================================================
// MAIN SEARCH PAGE COMPONENT
// ============================================================
function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const setSelectedMedia = useAppStore((s) => s.setSelectedMedia);

  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [genres, setGenres] = useState<Record<number, string>>({});

  // Parse URL params
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") as "movie" | "tv" || "movie";
  const genreId = searchParams.get("genre");
  const networkId = searchParams.get("network");

  // Determine search mode
  const isTextSearch = !!query;
  const isGenreSearch = !!genreId;
  const isNetworkSearch = !!networkId;

  // Fetch genres for display name
  useEffect(() => {
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => {
        const genreMap: Record<number, string> = {};
        if (data.movie) {
          data.movie.forEach((g: any) => (genreMap[g.id] = g.name));
        }
        if (data.tv) {
          data.tv.forEach((g: any) => (genreMap[g.id] = g.name));
        }
        setGenres(genreMap);
      })
      .catch(() => {});
  }, []);

  // Fetch results
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchResults = async () => {
      try {
        let url = "";

        if (isTextSearch) {
          // Text search
          url = `/api/search?q=${encodeURIComponent(query)}&page=${page}`;
        } else if (isNetworkSearch) {
          // Network filter (TV only)
          url = `/api/discover?type=tv&network=${networkId}&page=${page}&sort=popularity.desc`;
        } else if (isGenreSearch) {
          // Genre filter
          const params = new URLSearchParams({
            type,
            genre: genreId!,
            sort: "popularity.desc",
            page: String(page),
          });
          url = `/api/discover?${params.toString()}`;
        } else {
          // No search criteria — show popular
          url = `/api/${type === "tv" ? "tv" : "movies"}/popular?page=${page}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch results");
        const data = await res.json();

        setResults(data.results || []);
        setTotalPages(Math.min(data.total_pages || 1, 10)); // Limit to 10 pages
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, type, genreId, networkId, page, isTextSearch, isGenreSearch, isNetworkSearch]);

  // Reset page when search criteria changes
  useEffect(() => {
    setPage(1);
  }, [query, type, genreId, networkId]);

  // Handle movie click
  const handleMovieClick = (movie: Movie) => {
    const mediaType: "movie" | "tv" =
      movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    const selected: SelectedMedia = {
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    };
    setSelectedMedia(selected);
  };

  // Build page title
  const getPageTitle = () => {
    if (isTextSearch) return `"${query}"`;
    if (isNetworkSearch) {
      const network = NETWORKS[parseInt(networkId, 10)];
      return network ? network.name : "Network";
    }
    if (isGenreSearch) {
      const genreName = genres[parseInt(genreId, 10)] || "Genre";
      return `${genreName} ${type === "tv" ? "TV Shows" : "Movies"}`;
    }
    return t("popular_movies");
  };

  // Back to home
  const handleBack = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Header Section */}
      <div className="border-b border-border bg-card/30 pt-20">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </button>

          {/* Title + Filter info */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Search className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
              {getPageTitle()}
            </h1>

            {/* Filter badges */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type badge */}
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {type === "tv" ? <Tv className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                {type === "tv" ? "TV Shows" : "Movies"}
              </span>

              {/* Network badge with logo */}
              {isNetworkSearch && (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  <div className="relative h-3 w-8">
                    <Image
                      src={getImageUrl(NETWORKS[parseInt(networkId, 10)]?.logo_path, "w92")}
                      alt="Network"
                      fill
                      className="object-contain"
                      unoptimized
                      sizes="32px"
                    />
                  </div>
                  {NETWORKS[parseInt(networkId, 10)]?.name}
                </span>
              )}

              {/* Genre badge */}
              {isGenreSearch && genres[parseInt(genreId, 10)] && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  <Filter className="h-3 w-3" />
                  {genres[parseInt(genreId, 10)]}
                </span>
              )}
            </div>
          </div>

          {/* Result count */}
          {!loading && results.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {results.length} results {page > 1 && `· Page ${page}`}
            </p>
          )}
        </div>
      </div>

      {/* Results Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Loading state */}
        {loading && (
          <div className="flex h-96 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              {t("retry_button")}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results.length === 0 && (
          <div className="flex h-96 flex-col items-center justify-center gap-3 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isTextSearch ? "No results found" : "No content available"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isTextSearch
                  ? `Try different keywords for "${query}"`
                  : "Try selecting a different filter"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleBack} className="mt-2 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("back")} to Home
            </Button>
          </div>
        )}

        {/* Movie Grid */}
        {!loading && !error && results.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {results.map((movie) => {
                const title = movie.title || movie.name || "Untitled";
                const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
                const mediaType: "movie" | "tv" =
                  movie.media_type || (movie.title ? "movie" : "tv");
                const rating = movie.vote_average?.toFixed(1) || "N/A";

                return (
                  <button
                    key={`${movie.id}-${mediaType}`}
                    onClick={() => handleMovieClick(movie)}
                    className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary"
                  >
                    {movie.poster_path ? (
                      <Image
                        src={getImageUrl(movie.poster_path, "w500")}
                        alt={title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
                        className="object-cover transition-transform group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted">
                        {mediaType === "tv" ? (
                          <Tv className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <Film className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute left-2 top-2 flex items-center gap-1">
                      <span className="rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground backdrop-blur-sm">
                        {mediaType}
                      </span>
                    </div>

                    {/* Rating badge */}
                    <div className="absolute right-2 top-2">
                      <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] font-semibold text-yellow-400 backdrop-blur-sm">
                        ★ {rating}
                      </span>
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <h3 className="line-clamp-2 text-[11px] font-semibold text-white sm:text-xs">
                        {title}
                      </h3>
                      {year && (
                        <p className="mt-0.5 text-[9px] text-white/60">{year}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t("previous")}
                </Button>

                <span className="px-3 text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="gap-1.5"
                >
                  {t("next")}
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}

// ============================================================
// WRAPPER with Suspense (required for useSearchParams)
// ============================================================
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background">
          <Header />
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
