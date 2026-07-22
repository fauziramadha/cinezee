"use client";

import { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/tmdb";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SimilarList({ 
  items, 
  onItemClick 
}: { 
  items: any[]; 
  onItemClick: (item: any) => void; 
}) {
  const [filtered, setFiltered] = useState<any[]>([]);

  useEffect(() => {
    const filter = async () => {
      if (!items || items.length === 0) return;
      
      try {
        // Fetch VidAPI IDs
        const [movieRes, tvRes] = await Promise.all([
          fetch("/api/vidapi/ids/movie").then(r => r.json()).catch(() => ({ ids: [] })),
          fetch("/api/vidapi/ids/tv").then(r => r.json()).catch(() => ({ ids: [] }))
        ]);
        
        const movieIds = new Set(movieRes.ids || []);
        const tvIds = new Set(tvRes.ids || []);
        
        // Filter items yang ada di VidAPI
        const available = items.filter(item => {
          if (item.media_type === "movie" || (!item.media_type && item.title)) return movieIds.has(String(item.id));
          if (item.media_type === "tv" || (!item.media_type && item.name)) return tvIds.has(String(item.id));
          return false;
        }).slice(0, 15);
        
        setFiltered(available);
      } catch (e) {
        console.error("SimilarList filter error:", e);
      }
    };
    filter();
  }, [items]);

  if (filtered.length === 0) return null;

  return (
    <div className="mt-6 border-t border-zinc-800 pt-6">
      <h3 className="mb-3 text-sm font-bold text-white sm:text-base">Tontonan Serupa</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filtered.map((m) => (
          <div 
            key={m.id} 
            className="w-28 shrink-0 cursor-pointer transition hover:scale-105 sm:w-32"
            onClick={() => onItemClick(m)}
          >
            <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-800">
              <img
                src={getImageUrl(m.poster_path, "w342")}
                alt={m.title || m.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-1 truncate text-xs text-white">{m.title || m.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
