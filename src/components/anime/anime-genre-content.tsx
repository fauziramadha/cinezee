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
  episodes?: number | string;
  releaseDay?: string;
  latestReleaseDate?: string;
  animeId: string;
  href: string;
  source?: "otakudesu" | "animasu";
}

interface AnimeGenreContentProps {
  slug: string;
  source?: "otakudesu" | "animasu";
}

export function AnimeGenreContent({
  slug,
  source = "otakudesu",
}: AnimeGenreContentProps) {
  const router = useRouter();
  const [animeList, setAnimeList] = useState<AnimeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const displayGenreName =
    slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

  // === Load anime by genre ===
  const loadData = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      try {
        const endpoint =
          source === "animasu"
            ? `/api/anime/animasu/genre/${slug}?page=${pageNum}`
            : `/api/anime/genre/${slug}?page=${pageNum}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Animasu: array langsung atau di data, Otakudesu: data.animeList
        const rawList =
          source === "animasu"
            ? Array.isArray(json)
              ? json
              : json?.data?.animeList || json?.data || []
            : json?.data?.animeList || [];
        const list = rawList.map((item: any) => ({
          ...item,
          animeId: item.slug || item.animeId,
          source,
        }));
        setAnimeList(list);

        // Heuristic pagination
        setHasNextPage(list.length >= 10);

        if (pageNum > 1 && list.length === 0) {
          setPage(pageNum - 1);
          loadData(pageNum - 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [slug, source]
  );

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [loadData, source, slug]);

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
        <button
          onClick={() => router.push("/anime")}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Anime
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Genre: {displayGenreName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jelajahi anime dengan genre {displayGenreName.toLowerCase()}.
          </p>
        </div>

        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => loadData(page)}>
              Coba lagi
            </Button>
          </div>
        )}

        {!loading && !error && animeList.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {animeList.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>

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
