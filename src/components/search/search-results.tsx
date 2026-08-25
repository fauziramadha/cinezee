"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { MovieCard, type MediaItem } from "@/components/cinepro/movie-card";
import { AnimeCard } from "@/components/anime/anime-card";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { ComicCard } from "@/components/comic/comic-card";
import { DrakorCard } from "@/components/drakor/drakor-card";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api/vps";

interface Props {
  query: string;
  context: string;
  activeTab: string;
  onClose: () => void;
}

export function SearchResults({ query, context, activeTab, onClose }: Props) {
  const router = useRouter();
  const { setSelectedMedia, animeServer } = useAppStore();
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || activeTab !== "results") {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (context === "movie") {
          // Fetch dari VPS API (Live Search)
          const res = await fetch(`${VPS_API_BASE}/api/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          
          // Format ke MediaItem
          const items: MediaItem[] = (data.data?.results || []).map((item: any) => ({
            id: String(item.cinemacity_id),
            cinemacityId: String(item.cinemacity_id),
            slug: item.slug,
            title: item.title || "Untitled",
            type: item.type === "tv" ? "tv" : "movie",
            poster: item.poster_url ? `${VPS_API_BASE}/api/image?url=${encodeURIComponent(item.poster_url)}` : "/placeholder-poster.png",
            backdrop: item.poster_url ? `${VPS_API_BASE}/api/image?url=${encodeURIComponent(item.poster_url)}` : "/placeholder-poster.png",
            overview: item.description || "",
            year: item.release_year ? String(item.release_year) : "",
            rating: item.rating ? parseFloat(item.rating) : 0,
          }));
          setResults(items);
        }
        else if (context === "anime") {
          const endpoint = animeServer === "animasu"
            ? "/api/anime/animasu/search/" + encodeURIComponent(query)
            : "/api/anime/search/" + encodeURIComponent(query);
          const res = await fetch(endpoint);
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          const rawList = animeServer === "animasu" ? (data?.animes || data?.data || []) : (data?.data?.animeList || []);
          setResults(rawList.map((item: any) => ({ ...item, animeId: item.slug || item.animeId, source: animeServer })));
        }
        else if (context === "donghua") {
          const endpoint = "/api/donghua/search?q=" + encodeURIComponent(query) + "&page=1";
          const res = await fetch(endpoint);
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          // VPS FastAPI response: { items: [...], pagination: {...} }
          const rawList = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : []);
          setResults(rawList.map((item: any) => ({ ...item, slug: (item.slug || "").replace(/\/+$/, "").trim(), source: "s1" as const })));
        }
        else if (context === "comic") {
          const res = await fetch("/api/indocast/komiku/search?q=" + encodeURIComponent(query));
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          setResults((data?.items || []).map((item: any) => ({ ...item, slug: item.slug || (item.link || "").replace(/^\/(manga|detail-komik)\//, "").replace(/\/$/, "") })));
        }
        else if (context === "drakor") {
          const res = await fetch("/api/drakor/search?q=" + encodeURIComponent(query));
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          const inner = data?.data !== undefined && data?.code !== undefined ? data.data : data;
          setResults((inner?.items || []).map((item: any) => ({ ...item, id: (item.id || item.slug || "").toString().trim() })));
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, activeTab, context, animeServer]);

  const handleSelectMovie = (item: MediaItem) => {
    setSelectedMedia({
      id: item.cinemacityId || item.id,
      cinemacityId: item.cinemacityId,
      slug: item.slug,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
    } as any);
    onClose();
  };

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!query.trim() && context === "movie") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <Search className="mb-2 h-8 w-8 opacity-30" />
        Start typing or press Enter to search
      </div>
    );
  }

  if (results.length === 0 && query.trim()) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil untuk "{query}".</p>;
  }

  return (
    <div className="p-4">
      {context === "movie" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
          {results.map((item: MediaItem) => (
            <MovieCard 
              key={`${item.id}-${item.slug}`} 
              item={item} 
              onClick={handleSelectMovie}
              className="w-full" 
            />
          ))}
        </div>
      )}

      {context === "anime" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.map((item) => <AnimeCard key={item.animeId} anime={item} />)}
        </div>
      )}

      {context === "donghua" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.map((item) => <DonghuaCard key={item.slug} donghua={item} />)}
        </div>
      )}

      {context === "comic" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.map((item) => <ComicCard key={item.slug} comic={item} />)}
        </div>
      )}

      {context === "drakor" && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.map((item) => <DrakorCard key={item.id || item.slug} drakor={item} />)}
        </div>
      )}

      {context === "movie" && query.trim() && (
        <div className="mt-4 shrink-0 border-t border-border pt-3">
          <button onClick={() => { router.push("/search?q=" + encodeURIComponent(query.trim())); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 py-2 text-xs font-semibold text-primary hover:bg-muted">
            See all results for {query}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
