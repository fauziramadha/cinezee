"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, Film } from "lucide-react";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api/vps";

// FIX: Pakai VPS API /api/search (sebelumnya pakai /api/tmdb/* yang tidak ada)
// VPS API return { success, data: { results: [{ cinemacity_id, slug, title, type, poster_url, release_year, rating }] } }

export interface MediaResult {
  id: string;            // cinemacity_id
  cinemacity_id: string;
  slug: string;
  title: string;
  type: "movie" | "tv";
  poster_url: string | null;
  release_year: number | null;
  rating: number | null;
}

export function SubtitleSearch({ onSelect }: { onSelect: (media: MediaResult | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaResult | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${VPS_API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          const items = (json.data?.results || []).slice(0, 10).map((item: any): MediaResult => ({
            id: String(item.cinemacity_id || item.id),
            cinemacity_id: String(item.cinemacity_id || item.id),
            slug: item.slug || "",
            title: item.title || "Untitled",
            type: item.type === "tv" ? "tv" : "movie",
            poster_url: item.poster_url || null,
            release_year: item.release_year || null,
            rating: item.rating || null,
          }));
          setResults(items);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (media: MediaResult) => {
    setSelected(media);
    setQuery("");
    setResults([]);
    onSelect(media);
  };

  const handleClear = () => {
    setSelected(null);
    onSelect(null);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">1. Cari Film / TV Series</h2>
      <p className="text-xs text-muted-foreground">
        Cari berdasarkan judul. Pakai database CineStream (cinemacity.cc).
      </p>

      {selected ? (
        <div className="flex items-center gap-3 rounded-md bg-primary/10 p-2">
          {selected.poster_url ? (
            <img
              src={`${VPS_API_BASE}/api/image?url=${encodeURIComponent(selected.poster_url)}`}
              alt=""
              className="h-14 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
              <Film className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {selected.type === "tv" ? "TV Series" : "Movie"}
              </Badge>
              {selected.release_year && (
                <span className="text-[10px] text-muted-foreground">{selected.release_year}</span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm font-medium">{selected.title}</p>
            <p className="text-[10px] text-muted-foreground">ID: {selected.cinemacity_id} · slug: {selected.slug}</p>
          </div>
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ketik judul film... (misal: Dracula, Lanterns)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
          )}
        </div>
      )}

      {results.length > 0 && !selected && (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border bg-background p-2">
          {results.map((media) => (
            <button
              key={`${media.cinemacity_id}-${media.type}`}
              onClick={() => handleSelect(media)}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
            >
              {media.poster_url ? (
                <img
                  src={`${VPS_API_BASE}/api/image?url=${encodeURIComponent(media.poster_url)}`}
                  alt=""
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{media.title}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {media.type === "tv" ? "TV" : "Movie"}
                  </Badge>
                  {media.release_year && (
                    <span className="text-[10px] text-muted-foreground">{media.release_year}</span>
                  )}
                  {media.rating && (
                    <span className="text-[10px] text-muted-foreground">★ {Number(media.rating).toFixed(1)}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
