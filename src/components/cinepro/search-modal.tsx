"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Search, X, Film, Tv, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, type SelectedMedia } from "@/lib/store";
import { getImageUrl, type Movie } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

export function SearchModal() {
  const { searchOpen, setSearchOpen, setSelectedMedia } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut ⌘K
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    },
    [setSearchOpen],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset query when modal closes
  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [searchOpen]);

  const handleSelect = (movie: Movie) => {
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
    setSearchOpen(false);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Movies and TV Shows</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-6 text-center text-sm text-destructive">{error}</div>
          )}

          {!query.trim() && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-30" />
              Start typing to search across thousands of movies and TV shows
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && !error && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-border">
              {results.map((movie) => {
                const title = movie.title || movie.name || "Untitled";
                const year = (movie.release_date || movie.first_air_date || "").split("-")[0];
                const mediaType: "movie" | "tv" =
                  movie.media_type || (movie.title ? "movie" : "tv");
                const rating = movie.vote_average?.toFixed(1) || "N/A";

                return (
                  <button
                    key={`${movie.id}-${mediaType}`}
                    onClick={() => handleSelect(movie)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    )}
                  >
                    {/* Poster thumbnail */}
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      {movie.poster_path ? (
                        <Image
                          src={getImageUrl(movie.poster_path, "w185")}
                          alt={title}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          {mediaType === "tv" ? (
                            <Tv className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Film className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{title}</h3>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="uppercase">{mediaType}</span>
                        {year && (
                          <>
                            <span>•</span>
                            <span>{year}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>★ {rating}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1 py-0.5 font-mono">esc</kbd> to
          close •
          <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono">↵</kbd> to
          open
        </div>
      </DialogContent>
    </Dialog>
  );
}
