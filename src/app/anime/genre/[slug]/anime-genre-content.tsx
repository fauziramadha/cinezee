"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { AnimeCard } from "@/components/anime/anime-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnimeListItem {
  title: string;
  poster?: string;
  episodes?: number;
  releaseDay?: string;
  latestReleaseDate?: string;
  animeId: string;
  href: string;
}

interface AnimeGenreContentProps {
  slug: string;
}

export function AnimeGenreContent({ slug }: AnimeGenreContentProps) {
  const router = useRouter();
  const [animeList, setAnimeList] = useState<AnimeListItem[]>([]);
  const [genreName, setGenreName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Capitalize genre slug untuk display
  const displayGenreName =
    genreName || slug.charAt(0).toUpperCase() + slug.slice(1);

  // === Load anime by genre ===
  const loadData = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/anime/genre/${slug}?page=${pageNum}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const list = json?.data?.animeList || [];
        setAnimeList(list);

        // Cek pagination
        const pagination = json?.data?.pagination;
        setHasNextPage(pagination?.hasNextPage || list.length >= 20);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  // === Initial load ===
  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [loadData]);

  // === Pagination ===
  const handlePrevPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      loadData(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      const newPage = page + 1;
      setPage(newPage);
      loadData(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Back button */}
        <button
          onClick={() => router.push("/anime")}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Anime
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Genre: {displayGenreName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jelajahi anime dengan genre {displayGenreName.toLowerCase()}.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => loadData(page)}>
              Coba lagi
            </Button>
          </div>
        )}

        {/* Anime grid */}
        {!loading && !error && animeList.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {animeList.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>

              <span className="px-3 text-sm font-medium text-muted-foreground">
                Halaman {page}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage || loading}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !error && animeList.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Tidak ada anime untuk genre ini.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/anime")}
            >
              Kembali ke Anime
            </Button>
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
