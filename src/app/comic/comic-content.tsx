"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ComicCard } from "@/components/comic/comic-card";
import { Loader2, Search, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ComicListItem {
  title: string;
  slug: string;
  thumbnail?: string;
  image?: string;
  poster?: string;
  type?: string;
  genre?: string;
  status?: string;
  chapter?: string;
  description?: string;
  time_ago?: string;
}

type Tab = "home" | "terbaru" | "populer" | "trending" | "recommendations";

// Extract slug from link: "/manga/naruto/" → "naruto"
function extractSlug(link: string): string {
  if (!link) return "";
  // Remove protocol and domain if full URL
  let path = link.replace(/^https?:\/\/[^/]+/, "");
  // Remove /manga/ or /detail-komik/ prefix
  path = path.replace(/^\/(manga|detail-komik)\//, "");
  // Remove trailing slash
  return path.replace(/\/$/, "").replace(/\/$/, "");
}

export function ComicContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [items, setItems] = useState<ComicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ComicListItem[]>([]);
  const [searching, setSearching] = useState(false);

  const normalize = (list: any[]): ComicListItem[] => {
    return list.map((item: any) => ({
      title: item.title || "Untitled",
      slug: item.slug || extractSlug(item.link || item.href || ""),
      thumbnail: item.thumbnail || item.image || item.poster || null,
      image: item.image || item.thumbnail || item.poster || null,
      type: item.type || "Manga",
      genre: item.genre || undefined,
      status: item.status || undefined,
      chapter: item.chapter || undefined,
      description: item.description || undefined,
      time_ago: item.time_ago || undefined,
    }));
  };

  const loadData = useCallback(async (tab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "";
            // Homepage API only returns promotional APK, use "terbaru" for real comics
      if (tab === "home") endpoint = `/api/comic/terbaru`;
      else if (tab === "terbaru") endpoint = `/api/comic/terbaru`;
      else if (tab === "populer") endpoint = `/api/comic/populer`;
      else if (tab === "trending") endpoint = `/api/comic/trending`;
      else if (tab === "recommendations") endpoint = `/api/comic/recommendations`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Different endpoints use different field names for the array
      let rawList: any[] = [];
      if (tab === "home" || tab === "terbaru" || tab === "populer") {
        // terbaru/populer: { comics: [] }
        rawList = json?.comics || json?.data || [];
      } else if (tab === "trending") {
        // terbaru/populer: { comics: [] }
        rawList = json?.comics || json?.data || [];
      } else if (tab === "trending") {
        // trending: { trending: [] }
        rawList = json?.trending || json?.comics || json?.data || [];
      } else {
        // recommendations: could be any
        rawList = json?.data || json?.comics || json?.recommendations || [];
      }

      const list = normalize(rawList);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData("home"); }, [loadData]);

  useEffect(() => {
    if (activeTab !== "home") { loadData(activeTab); }
  }, [activeTab, loadData]);

  const handleRefresh = () => { loadData(activeTab); };

  // Search dengan debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/comic/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        // Search: { data: [...] }
        const rawList = json?.data || (Array.isArray(json) ? json : []);
        const list = normalize(rawList);
        setSearchResults(list);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showSearch = searchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Komik</h1>
          <p className="mt-1 text-sm text-muted-foreground">Baca manga, manhwa, manhua gratis. Update tiap hari.</p>
        </div>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="Cari komik... (misal: Naruto, Solo Leveling)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {!showSearch && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <button onClick={handleRefresh} className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Refresh">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
              {(["home", "terbaru", "populer", "trending", "recommendations"] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors", activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                  {tab === "home" && "Beranda"}{tab === "terbaru" && "Terbaru"}{tab === "populer" && "Populer"}{tab === "trending" && "Trending"}{tab === "recommendations" && "Rekomendasi"}
                </button>
              ))}
            </div>
          </>
        )}
        {loading && !showSearch && (<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>)}
        {error && !showSearch && (<div className="flex h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="secondary" size="sm" onClick={handleRefresh}>Coba lagi</Button></div>)}
        {showSearch && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-bold">Hasil pencarian: &quot;{searchQuery}&quot;</h2>
            {searching ? (<div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {searchResults.map((c) => (<ComicCard key={c.slug} comic={c} />))}
              </div>
            ) : (<p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>)}
          </section>
        )}
        {!showSearch && activeTab === "home" && !loading && !error && (
          <>
            <div className="mb-6"><a href="/" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"><ArrowLeft className="h-4 w-4" />Kembali ke Beranda</a></div>
            {items.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold">🔥 Komik Terbaru</h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {items.slice(0, 14).map((c) => (<ComicCard key={c.slug} comic={c} />))}
                </div>
              </section>
            )}
          </>
        )}
        {!showSearch && activeTab !== "home" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">{activeTab === "terbaru" ? "Terbaru" : activeTab === "populer" ? "Populer" : activeTab === "trending" ? "Trending" : "Rekomendasi"}</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {items.map((c) => (<ComicCard key={c.slug} comic={c} />))}
            </div>
          </section>
        )}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
