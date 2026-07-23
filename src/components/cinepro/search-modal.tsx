"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Loader2, Clapperboard } from "lucide-react";
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

type TabView = "results" | "genres" | "kategori";

export function SearchModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { searchOpen, setSearchOpen } = useAppStore();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabView>("results");

  const context = pathname.startsWith("/anime") ? "anime"
                : pathname.startsWith("/donghua") ? "donghua"
                : pathname.startsWith("/comic") ? "comic"
                : pathname.startsWith("/drakor") ? "drakor"
                : "movie";

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

          {context === "movie" && activeTab === "genres" && (
            <div className="min-w-0 p-4 pb-20 text-center text-sm text-muted-foreground">
              Genre browsing via TMDB akan datang segera.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
