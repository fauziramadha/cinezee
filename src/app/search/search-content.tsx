"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, ArrowLeft, Loader2 } from "lucide-react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { MovieCard } from "@/components/cinepro/movie-card";
import { AnimeCard } from "@/components/anime/anime-card";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { ComicCard } from "@/components/comic/comic-card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Import modal yang diperlukan agar bisa klik card film
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";

type Category = "all" | "movies" | "anime" | "donghua" | "comic";

export function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = (searchParams.get("cat") as Category) || "all";

  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<Category>(initialCategory);
  const [results, setResults] = useState<{ type: string; data: any[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Normalisasi slug untuk anime/donghua/komik
  const normalizeAnime = (list: any[]) => list.map(item => ({ ...item, animeId: item.slug || item.animeId, source: "otakudesu" }));
  const normalizeDonghua = (list: any[]) => list.map(item => ({ ...item, slug: (item.slug || "").replace(/\/$/, ""), source: "s1" }));
  const normalizeComic = (list: any[]) => list.map(item => ({ ...item, slug: item.slug || (item.link || "").replace(/^\/(manga|detail-komik)\//, "").replace(/\/$/, "") }));

  const performSearch = useCallback(async (q: string, cat: Category) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);

    const searchPromises = [];
    const typesToSearch: Category[] = cat === "all" ? ["movies", "anime", "donghua", "comic"] : [cat];

    if (typesToSearch.includes("movies")) {
      searchPromises.push(
        fetch(`/api/search?q=${encodeURIComponent(q)}`)
          .then(res => res.json())
          .then(json => ({ type: "movies", data: json.results || [] }))
          .catch(() => ({ type: "movies", data: [] }))
      );
    }
    if (typesToSearch.includes("anime")) {
      searchPromises.push(
        fetch(`/api/anime/search/${encodeURIComponent(q)}`)
          .then(res => res.json())
          .then(json => ({ type: "anime", data: normalizeAnime(json?.data?.animeList || []) }))
          .catch(() => ({ type: "anime", data: [] }))
      );
    }
    if (typesToSearch.includes("donghua")) {
      searchPromises.push(
        fetch(`/api/donghua/donghua/search/${encodeURIComponent(q)}/1`)
          .then(res => res.json())
          .then(json => ({ type: "donghua", data: normalizeDonghua(json?.data || []) }))
          .catch(() => ({ type: "donghua", data: [] }))
      );
    }
    if (typesToSearch.includes("comic")) {
      searchPromises.push(
        fetch(`/api/indocast/komiku/search?q=${encodeURIComponent(q)}`)
          .then(res => res.json())
          .then(json => ({ type: "comic", data: normalizeComic(json?.items || []) }))
          .catch(() => ({ type: "comic", data: [] }))
      );
    }

    const searchResults = await Promise.all(searchPromises);
    setResults(searchResults.filter(r => r.data.length > 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, initialCategory);
    }
  }, [initialQuery, initialCategory, performSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) params.set("q", value);
    else params.delete("q");
    window.history.replaceState(null, "", `/search?${params.toString()}`);
  };

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    const params = new URLSearchParams(window.location.search);
    if (cat !== "all") params.set("cat", cat);
    else params.delete("cat");
    window.history.replaceState(null, "", `/search?${params.toString()}`);
    performSearch(query, cat);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, activeCategory);
  };

  const categoryLabels: Record<Category, string> = {
    all: "Semua",
    movies: "Film & TV",
    anime: "Anime",
    donghua: "Donghua",
    comic: "Komik",
  };

  const totalResults = results.reduce((sum, r) => sum + r.data.length, 0);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <button onClick={() => router.push("/")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </button>

        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Search className="h-6 w-6 text-primary" />
            Pencarian CineStream
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cari film, anime, donghua, dan komik dalam satu tempat.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ketik judul... (misal: One Piece, Naruto, Avengers)"
            value={query}
            onChange={handleInputChange}
            className="pl-9 h-12 text-base"
            autoFocus
          />
        </form>

        {/* Category Filter */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
          {(["all", "movies", "anime", "donghua", "comic"] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasSearched && totalResults === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">Tidak ada hasil ditemukan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Coba kata kunci lain atau periksa ejaan.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {results.map((result) => (
              <section key={result.type}>
                <h2 className="mb-4 text-lg font-bold capitalize">
                  {categoryLabels[result.type as Category] || result.type}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({result.data.length} hasil)
                  </span>
                </h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {result.type === "movies" && result.data.map((item) => (
                    <MovieCard key={`${item.id}-${item.media_type}`} movie={item} />
                  ))}
                  {result.type === "anime" && result.data.map((item) => (
                    <AnimeCard key={item.animeId} anime={item} />
                  ))}
                  {result.type === "donghua" && result.data.map((item) => (
                    <DonghuaCard key={item.slug} donghua={item} />
                  ))}
                  {result.type === "comic" && result.data.map((item) => (
                    <ComicCard key={item.slug} comic={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <Footer />
      
      {/* Render modals agar MovieCard bisa diklik */}
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
