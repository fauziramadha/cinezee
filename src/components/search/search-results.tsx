"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, Film, Tv, Loader2, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getImageUrl } from "@/lib/tmdb";
import { AnimeCard } from "@/components/anime/anime-card";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { ComicCard } from "@/components/comic/comic-card";
import { DrakorCard } from "@/components/drakor/drakor-card";

interface Props {
  query: string;
  context: string;
  activeTab: string;
  onClose: () => void;
}

export function SearchResults({ query, context, activeTab, onClose }: Props) {
  const router = useRouter();
  const { setSelectedMedia, animeServer, donghuaServer } = useAppStore();
  
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
          // Pakai API Search baru (sudah difilter VidAPI di server)
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          setResults(data.results || []);
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
          const endpoint = donghuaServer === "s2"
            ? "/api/donghua/donghub/search/" + encodeURIComponent(query) + "/1"
            : "/api/donghua/donghua/search/" + encodeURIComponent(query) + "/1";
          const res = await fetch(endpoint);
          if (!res.ok) throw new Error("Fetch failed");
          const data = await res.json();
          const rawList = data?.data || [];
          setResults(rawList.map((item: any) => ({ ...item, slug: (item.slug || "").replace(/\/$/, ""), source: donghuaServer })));
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
  }, [query, activeTab, context, animeServer, donghuaServer]);

  const handleSelectMovie = (movie: any) => {
    const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
    setSelectedMedia({
      id: movie.id,
      type: mediaType,
      title: movie.title || movie.name || "Untitled",
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
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
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.map((movie) => {
            const title = movie.title || movie.name || "Untitled";
            const mediaType: "movie" | "tv" = movie.media_type || (movie.title ? "movie" : "tv");
            const rating = movie.vote_average?.toFixed(1) || "N/A";
            const year = movie.release_date?.split("-")[0] || movie.first_air_date?.split("-")[0];
            return (
              <button key={movie.id + "-" + mediaType} onClick={() => handleSelectMovie(movie)} className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-card text-left transition-all hover:ring-2 hover:ring-primary">
                <Image src={getImageUrl(movie.poster_path, "w500")} alt={title} fill sizes="(max-width: 768px) 30vw, 150px" className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 p-2">
                  <span className="rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground">{mediaType}</span>
                  <h3 className="mt-1 line-clamp-2 text-[11px] font-semibold text-white sm:text-xs">{title}</h3>
                  <div className="flex items-center gap-1">
                    {rating !== "N/A" && <span className="text-[9px] text-white/60">{rating}</span>}
                    {year && <span className="text-[9px] text-white/60">• {year}</span>}
                  </div>
                </div>
              </button>
            );
          })}
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
