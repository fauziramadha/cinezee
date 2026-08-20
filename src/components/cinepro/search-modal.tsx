"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Loader2, Clapperboard, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SearchResults } from "@/components/search/search-results";
import { DrakorKategoriList } from "@/components/drakor/drakor-kategori-list";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api/vps";

type TabView = "results" | "genres" | "kategori";

export function SearchModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { searchOpen, setSearchOpen } = useAppStore();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabView>("results");
  const [genres, setGenres] = useState<{ name: string; slug: string }[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);

  const context = pathname.startsWith("/anime") ? "anime"
                : pathname.startsWith("/donghua") ? "donghua"
                : pathname.startsWith("/comic") ? "comic"
                : pathname.startsWith("/drakor") ? "drakor"
                : "movie";

  // Fetch genres dari VPS API saat tab Genres di-klik
  useEffect(() => {
    if (activeTab === "genres" && context === "movie" && genres.length === 0) {
      setGenresLoading(true);
      fetch(`${VPS_API_BASE}/api/genre`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setGenres(data.data);
          }
        })
        .catch((err) => console.error("Failed to fetch genres:", err))
        .finally(() => setGenresLoading(false));
    }
  }, [activeTab, context, genres.length]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setActiveTab("results");
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      if (context === "movie") {
        router.push("/search?q=" + encodeURIComponent(query.trim()));
      }
      setSearchOpen(false);
    }
  };

  const handleGenreClick = (slug: string) => {
    router.push(`/genre/${slug}`);
    setSearchOpen(false);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search {context}</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="shrink-0 border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveTab("results"); }}
              onKeyDown={handleSearchSubmit}
              placeholder={"Search " + context + "..."}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:text-base"
            />
            <button onClick={() => setSearchOpen(false)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close search">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs Filter */}
        {(context === "movie" || context === "drakor") && (
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 py-2">
            <button
              onClick={() => setActiveTab("results")}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === "results" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Search className="h-3.5 w-3.5" /> Results
            </button>

            {context === "movie" && (
              <button
                onClick={() => setActiveTab("genres")}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeTab === "genres" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Clapperboard className="h-3.5 w-3.5" /> Genres
              </button>
            )}

            {context === "drakor" && (
              <button
                onClick={() => setActiveTab("kategori")}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeTab === "kategori" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Clapperboard className="h-3.5 w-3.5" /> Kategori
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden" style={{ maxHeight: "70vh", scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
          <style>{`.search-scroll::-webkit-scrollbar { display: none; }`}</style>

          {activeTab === "results" && (
            <SearchResults 
              query={query} 
              context={context} 
              activeTab={activeTab} 
              onClose={() => setSearchOpen(false)} 
            />
          )}

          {context === "drakor" && activeTab === "kategori" && (
            <DrakorKategoriList />
          )}

          {/* === Genre List (VPS API) === */}
          {context === "movie" && activeTab === "genres" && (
            <div className="min-w-0 p-4 pb-20">
              {genresLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : genres.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {genres.map((genre) => (
                    <button
                      key={genre.slug}
                      onClick={() => handleGenreClick(genre.slug)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2.5 text-left text-sm font-medium transition-all hover:border-primary hover:bg-primary/10"
                    >
                      <Film className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{genre.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">Belum ada genre tersedia.</p>
                  <p className="text-xs text-muted-foreground/70">Trigger scraper untuk mengambil genre terbaru.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
