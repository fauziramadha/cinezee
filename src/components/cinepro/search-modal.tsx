"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, Film, Tv, Loader2, ArrowRight, Clapperboard, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface Genre { id: number; name: string; }
interface Network { id: number; name: string; logo_path: string | null; }
type TabView = "results" | "genres" | "networks";

export function SearchModal() {
  const router = useRouter();
  const { searchOpen, setSearchOpen, setSelectedMedia } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabView>("results");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);

  useEffect(() => {
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => {
        if (data.movie) setMovieGenres(data.movie);
        if (data.tv) setTvGenres(data.tv);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNetworksLoading(true);
    fetch("/api/networks")
      .then((res) => res.json())
      .then((data) => setNetworks(data.networks || []))
      .catch(() => {})
      .finally(() => setNetworksLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "results" || !query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, activeTab]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
      setActiveTab("results");
      setSelectedGenre(null);
      setType("movie");
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  };

  const handleSelect = (movie: Movie) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    setSelectedMedia({
      id: movie.id,
      type: mediaType,
      title: movie.title || movie.name || "Untitled",
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    });
    setSearchOpen(false);
  };

  const handleBrowseGenre = () => {
    if (!selectedGenre) return;
    router.push(`/search?type=${type}&genre=${selectedGenre.id}`);
    setSearchOpen(false);
  };

  const handleNetworkSelect = (networkId: number) => {
    router.push(`/search?type=tv&network=${networkId}`);
    setSearchOpen(false);
  };

  const availableGenres = type === "tv" ? tvGenres : movieGenres;

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      {/* ============================================================ */}
      {/* FIX: Tambah w-full, min-w-0, dan w-[95vw] agar modal pas     */}
      {/* ============================================================ */}
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Movies and TV Shows</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveTab("results"); }}
            onKeyDown={handleSearchSubmit}
            placeholder="Search... (Press Enter)"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          <button onClick={() => setSearchOpen(false)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs Filter */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
          <button onClick={() => setActiveTab("results")} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors", activeTab === "results" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Search className="h-3.5 w-3.5" /> Results
          </button>
          <button onClick={() => setActiveTab("genres")} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors", activeTab === "genres" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Clapperboard className="h-3.5 w-3.5" /> Genres
          </button>
          <button onClick={() => setActiveTab("networks")} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors", activeTab === "networks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Radio className="h-3.5 w-3.5" /> Networks
          </button>

          {activeTab === "genres" && (
            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-muted p-0.5">
              <button onClick={() => { setType("movie"); setSelectedGenre(null); }} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", type === "movie" ? "bg-background text-foreground" : "text-muted-foreground")}>Movies</button>
              <button onClick={() => { setType("tv"); setSelectedGenre(null); }} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", type === "tv" ? "bg-background text-foreground" : "text-muted-foreground")}>TV</button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* FIX: min-w-0 + scrollbar-style none agar tidak terpotong     */}
        {/* ============================================================ */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden" style={{ maxHeight: "70vh", scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
          <style>{`
            /* Hide scrollbar for Chrome, Safari and Opera */
            .search-scroll::-webkit-scrollbar { display: none; }
          `}</style>

          {/* === TAB: RESULTS === */}
          {activeTab === "results" && (
            <>
              {!query.trim() && (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  <Search className="mb-2 h-8 w-8 opacity-30" />
                  Start typing or press Enter to search
                </div>
              )}

              {loading && (
                <div className="flex flex-1 items-center justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 md:grid-cols-5">
                  {results.slice(0, 10).map((movie) => {
                    const title = movie.title || movie.name || "Untitled";
                    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
                    const rating = movie.vote_average?.toFixed(1) || "N/A";
                    return (
                      <button key={`${movie.id}-${mediaType}`} onClick={() => handleSelect(movie)} className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary">
                        {movie.poster_path ? (
                          <Image src={getImageUrl(movie.poster_path, "w500")} alt={title} fill sizes="(max-width: 768px) 30vw, 150px" className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-muted">
                            {mediaType === "tv" ? <Tv className="h-8 w-8 text-muted-foreground" /> : <Film className="h-8 w-8 text-muted-foreground" />}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 p-2">
                          <span className="rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground">{mediaType}</span>
                          <h3 className="mt-1 line-clamp-2 text-[11px] font-semibold text-white sm:text-xs">{title}</h3>
                          <span className="text-[9px] text-white/60">★ {rating}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!loading && query.trim() && (
                <div className="shrink-0 border-t border-border p-3">
                  <button onClick={() => { router.push(`/search?q=${encodeURIComponent(query.trim())}`); setSearchOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 py-2 text-xs font-semibold text-primary hover:bg-muted">
                    See all results for &quot;{query}&quot;
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* === TAB: GENRES === */}
          {/* ============================================================ */}
          {/* FIX: min-w-0 + truncate text + gap-2.5                       */}
          {/* ============================================================ */}
          {activeTab === "genres" && (
            <div className="min-w-0 p-4 pb-20">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {availableGenres.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGenre(g)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-all",
                      selectedGenre?.id === g.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    <Clapperboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {/* FIX: truncate agar teks panjang tidak mendorong width */}
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === TAB: NETWORKS === */}
          {activeTab === "networks" && (
            <div className="min-w-0 p-4 pb-20">
              <p className="mb-3 text-xs text-muted-foreground">Browse TV shows by network:</p>
              {networksLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {networks.map((n) => (
                    <button key={n.id} onClick={() => handleNetworkSelect(n.id)} className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:bg-muted">
                      {n.logo_path ? (
                        <div className="relative h-8 w-full">
                          <Image src={getImageUrl(n.logo_path, "w154")} alt={n.name} fill className="object-contain" unoptimized sizes="100px" />
                        </div>
                      ) : (
                        <div className="flex h-8 items-center justify-center">
                          <Radio className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground">{n.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Browse button di LUAR scroll area */}
        {activeTab === "genres" && selectedGenre && (
          <div className="shrink-0 border-t border-border bg-background p-3">
            <button onClick={handleBrowseGenre} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Browse {selectedGenre.name} {type === "tv" ? "TV Shows" : "Movies"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
