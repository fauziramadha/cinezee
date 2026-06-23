"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Search, X, Film, Tv, Loader2, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface Genre {
  id: number;
  name: string;
}

export function SearchModal() {
  const { searchOpen, setSearchOpen, setSelectedMedia } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTvGenres] = useState<Genre[]>([]);
  const [type, setType] = useState<"all" | "movie" | "tv">("all");
  const [genre, setGenre] = useState<string>("all");
  const [year, setYear] = useState<string>("all");
  const [sort, setSort] = useState<string>("popularity.desc");

  // Fetch genres on mount
  useEffect(() => {
    fetch("/api/genres")
      .then((res) => res.json())
      .then((data) => {
        if (data.movie) setMovieGenres(data.movie);
        if (data.tv) setTvGenres(data.tv);
      })
      .catch(() => {});
  }, []);

  // Build URL helper
  const buildUrl = useCallback(() => {
    const isDiscover = !query.trim() && (genre !== "all" || year !== "all" || type !== "all");
    
    if (isDiscover) {
      const params = new URLSearchParams();
      const discoverType = type === "tv" ? "tv" : "movie";
      params.set("type", discoverType);
      if (genre !== "all") params.set("genre", genre);
      if (year !== "all") params.set("year", year);
      params.set("sort", sort);
      return `/api/discover?${params.toString()}`;
    }
    
    return `/api/search?q=${encodeURIComponent(query)}`;
  }, [query, genre, year, type, sort]);

  // Fetch results (debounced)
  useEffect(() => {
    if (!query.trim() && genre === "all" && year === "all" && type === "all") {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(buildUrl());
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [buildUrl, query, genre, year, type, sort]);

  // Keyboard shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    },
    [setSearchOpen],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset when modal closes
  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
      setError(null);
      setType("all");
      setGenre("all");
      setYear("all");
      setSort("popularity.desc");
    }
  }, [searchOpen]);

  const handleSelect = (movie: Movie) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    const title = movie.title || movie.name || "Untitled";
    const selected: SelectedMedia = {
      id: movie.id,
      type: mediaType,
      title,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
    };
    setSelectedMedia(selected);
    setSearchOpen(false);
  };

  const availableGenres = type === "tv" ? tvGenres : movieGenres;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-4xl md:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Movies and TV Shows</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows... or use filters below"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2-Column Layout: Filters + Results */}
        <div className="flex max-h-[70vh] flex-col md:flex-row">
          {/* Filters Sidebar */}
          <div className="w-full shrink-0 space-y-3 border-b border-border bg-muted/30 p-4 md:w-56 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground">Type</label>
              <Select value={type} onValueChange={(v) => { setType(v as any); setGenre("all"); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="movie">Movies</SelectItem>
                  <SelectItem value="tv">TV Shows</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground">Genre</label>
              <Select value={genre} onValueChange={setGenre} disabled={type === "all"}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {availableGenres.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground">Year</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground">Sort By</label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity.desc">Popularity</SelectItem>
                  <SelectItem value="vote_average.desc">Rating</SelectItem>
                  <SelectItem value="release_date.desc">Newest</SelectItem>
                  <SelectItem value="revenue.desc">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {error && (
              <div className="p-6 text-center text-sm text-destructive">{error}</div>
            )}

            {!query.trim() && genre === "all" && year === "all" && type === "all" && (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
                <Search className="mb-2 h-8 w-8 opacity-30" />
                Start typing or use filters to explore
              </div>
            )}

            {loading && (
              <div className="flex h-full items-center justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {!loading && results.length === 0 && (query.trim() || genre !== "all" || year !== "all" || type !== "all") && !error && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {results.map((movie) => {
                  const title = movie.title || movie.name || "Untitled";
                  const yearStr = (movie.release_date || movie.first_air_date || "").split("-")[0];
                  const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
                  const rating = movie.vote_average?.toFixed(1) || "N/A";

                  return (
                    <button
                      key={`${movie.id}-${mediaType}`}
                      onClick={() => handleSelect(movie)}
                      className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary"
                    >
                      {movie.poster_path ? (
                        <Image
                          src={getImageUrl(movie.poster_path, "w500")}
                          alt={title}
                          fill
                          sizes="(max-width: 768px) 50vw, 200px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted">
                          {mediaType === "tv" ? <Tv className="h-8 w-8 text-muted-foreground" /> : <Film className="h-8 w-8 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 p-2">
                        <div className="mb-1 flex items-center gap-1">
                          <span className="rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground">{mediaType}</span>
                          <span className="text-[8px] text-white/80">★ {rating}</span>
                        </div>
                        <h3 className="line-clamp-2 text-[11px] font-semibold text-white sm:text-xs">{title}</h3>
                        {yearStr && <p className="text-[9px] text-white/60">{yearStr}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono">esc</kbd> to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
