"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
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

// Import Cards for Anime, Donghua, Comic
import { AnimeCard } from "@/components/anime/anime-card";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { ComicCard } from "@/components/comic/comic-card";

interface Genre { id: number; name: string; }
interface Network { id: number; name: string; logo_path: string | null; }
type TabView = "results" | "genres" | "networks";

export function SearchModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { searchOpen, setSearchOpen, setSelectedMedia } = useAppStore();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Movie/TV specific state
  const [activeTab, setActiveTab] = useState<TabView>("results");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);

  // Determine context based on pathname
  const context = pathname.startsWith("/anime") ? "anime" 
                : pathname.startsWith("/donghua") ? "donghua" 
                : pathname.startsWith("/comic") ? "comic" 
                : "movie";

  // State for Anime/Donghua Server selection
  const [selectedServer, setSelectedServer] = useState<"s1" | "s2">("s1");

  // Fetch Genres & Networks (only if context is movie)
  useEffect(() => {
    if (context !== "movie") return;
    
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => {
        if (data.movie) setMovieGenres(data.movie);
        if (data.tv) setTvGenres(data.tv);
      })
      .catch(() => {});
  }, [context]);

  useEffect(() => {
    if (context !== "movie") return;
    
    setNetworksLoading(true);
    fetch("/api/networks")
      .then((res) => res.json())
      .then((data) => setNetworks(data.networks || []))
      .catch(() => {})
      .finally(() => setNetworksLoading(false));
  }, [context]);

  // Search Logic
  useEffect(() => {
    if (context === "movie" && activeTab !== "results") {
      setResults([]);
      return;
    }
    
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        let data: any;
        
        if (context === "movie") {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Fetch failed");
          data = await res.json();
          setResults(data.results || []);
        } 
        else if (context === "anime") {
          // Server 1 (Otakudesu) vs Server 2 (Animasu)
          const endpoint = selectedServer === "s2"
            ? `/api/anime/animasu/search/${encodeURIComponent(query)}`
            : `/api/anime/search/${encodeURIComponent(query)}`;
          const res = await fetch(endpoint);
          if (!res.ok) throw new Error("Fetch failed");
          data = await res.json();
          
          // Normalize for AnimeCard
          const rawList = selectedServer === "s2"
            ? (data?.animes || data?.data || [])
            : (data?.data?.animeList || []);
          const list = rawList.map((item: any) => ({ 
            ...item, 
            animeId: item.slug || item.animeId, 
            source: selectedServer === "s2" ? "animasu" : "otakudesu" 
          }));
          setResults(list);
        }
        else if (context === "donghua") {
          // Server 1 (Anichin) vs Server 2 (Donghub)
          const endpoint = selectedServer === "s2"
            ? `/api/donghua/donghub/search/${encodeURIComponent(query)}/1`
            : `/api/donghua/donghua/search/${encodeURIComponent(query)}/1`;
          const res = await fetch(endpoint);
          if (!res.ok) throw new Error("Fetch failed");
          data = await res.json();
          
          // Normalize for DonghuaCard
          const rawList = selectedServer === "s2"
            ? (data?.data || [])
            : (data?.data || []);
          const list = rawList.map((item: any) => ({ 
            ...item, 
            slug: (item.slug || "").replace(/\/$/, ""), 
            source: selectedServer === "s2" ? "s2" : "s1" 
          }));
          setResults(list);
        }
        else if (context === "comic") {
          const res = await fetch(`/api/indocast/komiku/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Fetch failed");
          data = await res.json();
          const list = (data?.items || []).map((item: any) => ({ 
            ...item, 
            slug: item.slug || (item.link || "").replace(/^\/(manga|detail-komik)\//, "").replace(/\/$/, ""),
            thumbnail: item.thumbnail || item.image,
            image: item.thumbnail || item.image,
            chapter: item.latestChapter || item.chapter
          }));
          setResults(list);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, activeTab, context, selectedServer]);

  // Reset state when modal closes or context changes
  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
      setActiveTab("results");
      setSelectedGenre(null);
      setType("movie");
      setSelectedServer("s1"); // Reset server to 1 on close
    }
  }, [searchOpen, context]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      if (context === "movie") {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
      setSearchOpen(false);
    }
  };

  const handleSelectMovie = (movie: Movie) => {
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
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search {context}</DialogTitle>
        </DialogHeader>

        {/* Search Input & Server Toggle */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveTab("results"); }}
              onKeyDown={handleSearchSubmit}
              placeholder={`Search ${context}...`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            <button onClick={() => setSearchOpen(false)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close search">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Server Toggle (Only for Anime & Donghua) */}
          {(context === "anime" || context === "donghua") && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <span className="text-xs text-muted-foreground">Server:</span>
              <div className="flex gap-1 rounded-full bg-muted p-1">
                <button
                  onClick={() => setSelectedServer("s1")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                    selectedServer === "s1" ? "bg-blue-500 text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Server 1
                </button>
                <button
                  onClick={() => setSelectedServer("s2")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                    selectedServer === "s2" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Server 2
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs Filter (Only for Movie context) */}
        {context === "movie" && (
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
        )}

        {/* Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden" style={{ maxHeight: "70vh", scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
          <style>{`
            .search-scroll::-webkit-scrollbar { display: none; }
          `}</style>

          {/* === MOVIE CONTEXT: RESULTS === */}
          {context === "movie" && activeTab === "results" && (
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
                      <button key={`${movie.id}-${mediaType}`} onClick={() => handleSelectMovie(movie)} className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary">
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

          {/* === ANIME CONTEXT: RESULTS === */}
          {context === "anime" && (
            <div className="p-4">
              {loading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {results.map((item) => <AnimeCard key={item.animeId} anime={item} />)}
                </div>
              ) : query.trim() ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Cari anime favoritmu...</p>
              )}
            </div>
          )}

          {/* === DONGHUA CONTEXT: RESULTS === */}
          {context === "donghua" && (
            <div className="p-4">
              {loading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {results.map((item) => <DonghuaCard key={item.slug} donghua={item} />)}
                </div>
              ) : query.trim() ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Cari donghua favoritmu...</p>
              )}
            </div>
          )}

          {/* === COMIC CONTEXT: RESULTS === */}
          {context === "comic" && (
            <div className="p-4">
              {loading ? (
                <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {results.map((item) => <ComicCard key={item.slug} comic={item} />)}
                </div>
              ) : query.trim() ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Cari komik favoritmu...</p>
              )}
            </div>
          )}

          {/* === MOVIE CONTEXT: GENRES === */}
          {context === "movie" && activeTab === "genres" && (
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
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* === MOVIE CONTEXT: NETWORKS === */}
          {context === "movie" && activeTab === "networks" && (
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

        {/* Browse button di LUAR scroll area (Movie Context Only) */}
        {context === "movie" && activeTab === "genres" && selectedGenre && (
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
