"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { AnimeCard } from "@/components/anime/anime-card";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export function AnimeSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AnimeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // === Sync dengan URL param ===
  useEffect(() => {
    if (initialQuery !== query) {
      setQuery(initialQuery);
      if (initialQuery) {
        performSearch(initialQuery);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }
  }, [initialQuery]);

  // === Search function ===
  const performSearch = async (keyword: string) => {
    if (!keyword.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/anime/search/${encodeURIComponent(keyword.trim())}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults(json?.data?.animeList || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // === Debounce search saat typing (500ms) ===
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // === Update URL saat search (untuk shareable URL) ===
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Update URL tanpa reload
    const url = value.trim()
      ? `/anime/search?q=${encodeURIComponent(value.trim())}`
      : "/anime/search";
    window.history.replaceState(null, "", url);
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
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Search className="h-6 w-6 text-primary" />
            Cari Anime
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari anime favorit kamu berdasarkan judul.
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ketik judul anime... (misal: One Piece, Naruto, Solo Leveling)"
            value={query}
            onChange={handleInputChange}
            className="pl-9"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        {loading && !hasSearched && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => performSearch(query)}>
              Coba lagi
            </Button>
          </div>
        )}

        {hasSearched && !loading && results.length === 0 && !error && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Tidak ada hasil</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Coba kata kunci lain atau periksa ejaan.
              </p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold">
              {loading ? "Mencari..." : `Hasil: ${results.length} anime`}
            </h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {results.map((anime) => (
                <AnimeCard key={anime.animeId} anime={anime} />
              ))}
            </div>
          </section>
        )}

        {/* Initial state hint */}
        {!hasSearched && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Mulai mencari anime</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ketik judul anime di kolom pencarian di atas.
              </p>
            </div>
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
