"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, Film } from "lucide-react";

export interface MediaResult {
  id: number;
  name?: string;
  title?: string;
  poster_path?: string;
  first_air_date?: string;
  release_date?: string;
  media_type?: string;
}

export function SubtitleSearch({ onSelect }: { onSelect: (media: MediaResult) => void }) {
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
        const res = await fetch(`/api/tmdb/search/multi?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results?.slice(0, 10) || []);
        }
      } catch {} finally {
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

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">1. Cari Film / TV Series</h2>
      
      {selected ? (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2">
          <Badge variant="secondary" className="text-[10px]">
            {selected.media_type === "tv" ? "TV Series" : "Movie"}
          </Badge>
          <span className="flex-1 truncate text-sm font-medium">
            {selected.name || selected.title}
          </span>
          <button
            onClick={() => { setSelected(null); onSelect(null as any); }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ketik judul film..."
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
              key={media.id}
              onClick={() => handleSelect(media)}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
            >
              {media.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${media.poster_path}`}
                  alt=""
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
                  <Film className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{media.name || media.title}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {media.media_type === "tv" ? "TV" : "Movie"}
                  </Badge>
                  {(media.first_air_date || media.release_date) && (
                    <span className="text-[10px] text-muted-foreground">
                      {(media.first_air_date || media.release_date)?.slice(0, 4)}
                    </span>
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
