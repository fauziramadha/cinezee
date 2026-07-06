"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { Loader2, Search, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DonghuaListItem {
  title: string;
  poster?: string;
  slug?: string;
  status?: string;
  current_episode?: string;
  type?: string;
}

type Tab = "home" | "ongoing" | "completed" | "latest";

export function DonghuaContent() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [items, setItems] = useState<DonghuaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DonghuaListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadData = useCallback(async (tab: Tab, pageNum: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "";
      if (tab === "home") endpoint = `/api/donghua/home/${pageNum}`;
      else if (tab === "ongoing") endpoint = `/api/donghua/ongoing/${pageNum}`;
      else if (tab === "completed") endpoint = `/api/donghua/completed/${pageNum}`;
      else if (tab === "latest") endpoint = `/api/donghua/latest/${pageNum}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Donghua API returns array at root level (latest_release, or direct array)
      const rawList = json?.latest_release || json?.ongoing || json?.completed || json?.latest || (Array.isArray(json) ? json : []);
      const list = rawList.map((item: any) => ({ ...item, slug: item.slug?.replace(/\/$/, "") }));
      
      if (pageNum === 1) setItems(list);
      else setItems((prev) => [...prev, ...list]);
      
      setHasMore(list.length >= 10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData("home"); }, [loadData]);

  useEffect(() => {
    if (activeTab !== "home") { setPage(1); loadData(activeTab, 1); }
  }, [activeTab, loadData]);

  // Search dengan debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/donghua/search/${encodeURIComponent(searchQuery.trim())}/1`);
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        const rawList = json?.results || json?.donghuaList || (Array.isArray(json) ? json : []);
        const list = rawList.map((item: any) => ({ ...item, slug: item.slug?.replace(/\/$/, "") }));
        setSearchResults(list);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLoadMore = () => { const n = page + 1; setPage(n); loadData(activeTab, n); };
  const handleRefresh = () => { setPage(1); loadData(activeTab, 1); };
  const showSearch = searchQuery.trim().length > 0;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Donghua</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tonton donghua sub Indo gratis. Update tiap hari.</p>
        </div>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="text" placeholder="Cari donghua..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {!showSearch && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Server:</span>
              <div className="flex gap-1 rounded-full bg-muted p-1">
                <button className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">Server 1</button>
              </div>
              <button onClick={handleRefresh} className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Refresh">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
              {(["home", "ongoing", "completed", "latest"] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors", activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                  {tab === "home" && "Beranda"}{tab === "ongoing" && "Sedang Tayang"}{tab === "completed" && "Tamat"}{tab === "latest" && "Terbaru"}
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
                {searchResults.map((d) => (<DonghuaCard key={d.slug} donghua={d} />))}
              </div>
            ) : (<p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>)}
          </section>
        )}
        {!showSearch && activeTab === "home" && !loading && !error && (
          <>
            <div className="mb-6"><a href="/" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"><ArrowLeft className="h-4 w-4" />Kembali ke Beranda</a></div>
            {items.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-bold">🔥 Rilisan Terbaru</h2>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {items.slice(0, 14).map((d) => (<DonghuaCard key={d.slug} donghua={d} />))}
                </div>
              </section>
            )}
          </>
        )}
        {!showSearch && activeTab !== "home" && !loading && !error && (
          <section>
            <h2 className="mb-4 text-lg font-bold">{activeTab === "ongoing" ? "Sedang Tayang" : activeTab === "completed" ? "Tamat" : "Terbaru"}</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {items.map((d) => (<DonghuaCard key={d.slug} donghua={d} />))}
            </div>
            {hasMore && (<div className="mt-6 flex justify-center"><Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loading} className="gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Muat lebih banyak</Button></div>)}
          </section>
        )}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
