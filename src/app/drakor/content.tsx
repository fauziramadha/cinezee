"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DrakorHero } from "@/components/drakor/drakor-hero";
import { DrakorRow } from "@/components/drakor/drakor-row";
import { DrakorCard } from "@/components/drakor/drakor-card";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

// Normalize DrakorID shape → format DrakorCard
// API shape: { id, url, imageUrl, title }
function normalizeDrakor(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => ({
    id: (item.id || item.slug || "").toString().replace(/\/+$/, "").trim(),
    slug: (item.id || item.slug || "").toString().replace(/\/+$/, "").trim(),
    title: item.title || "Untitled",
    imageUrl: item.imageUrl || item.poster || item.thumbnail || null,
    poster: item.imageUrl || item.poster || item.thumbnail || null,
    status: item.status || "Ongoing",
    episode: item.episode || item.current_episode || "",
    year: item.year || "",
    type: item.type || "Drama Korea",
  }));
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.status === "error" || res.statusCode) return res;
  // DrakorID: { code, message, data: {...} }
  if (res.data !== undefined && res.code !== undefined) return res.data;
  return res;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export function DrakorContent() {
  const [terbaru, setTerbaru] = useState<any[]>([]);
  const [ongoing, setOngoing] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch terbaru, ongoing, trending secara paralel
        const [terbaruRes, ongoingRes, trendingRes] = await Promise.all([
          fetchJSON("/api/drakor/terbaru?page=1").catch(() => null),
          fetchJSON("/api/drakor/ongoing?page=1").catch(() => null),
          fetchJSON("/api/drakor/trending").catch(() => null),
        ]);

        if (terbaruRes) {
          const inner = unwrap(terbaruRes);
          const items = normalizeDrakor(inner?.items || []);
          if (items.length > 0) setTerbaru(items);
        }
        if (ongoingRes) {
          const inner = unwrap(ongoingRes);
          const items = normalizeDrakor(inner?.items || []);
          if (items.length > 0) setOngoing(items);
        }
        // FIX: Trending shape berbeda - pakai hari_ini/minggu_ini/bulan_ini (bukan items)
        if (trendingRes) {
          const inner = unwrap(trendingRes);
          const trendingItems =
            inner?.hari_ini ||
            inner?.minggu_ini ||
            inner?.bulan_ini ||
            inner?.items ||
            [];
          const items = normalizeDrakor(trendingItems);
          if (items.length > 0) setTrending(items);
        }
      } catch (err) {
        console.error("Failed to load drakor home:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Search dengan debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchJSON(
          "/api/drakor/search?q=" + encodeURIComponent(searchQuery.trim())
        ).catch(() => null);
        if (res) {
          const inner = unwrap(res);
          setSearchResults(normalizeDrakor(inner?.items || []));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const showSearch = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer />
        <SearchModal />
        <DetailModal />
        <PlayerModal />
        <AuthModal />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {!showSearch ? (
        <>
          {terbaru.length > 0 && <DrakorHero drakors={terbaru} />}

          <div className="relative z-10 space-y-6 pb-16 pt-4 sm:space-y-8 sm:pt-6 md:-mt-16 md:space-y-10 md:pt-0 lg:-mt-24">
            <div className="px-4 sm:px-6 lg:px-8">
              <a
                href="/"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Beranda
              </a>
            </div>

            {terbaru.length > 0 && (
              <DrakorRow
                title="🔥 Drakor Terbaru"
                drakors={terbaru}
                href="/drakor/list/terbaru"
              />
            )}
            {trending.length > 0 && (
              <DrakorRow
                title="📈 Trending"
                drakors={trending}
                href="/drakor/list/trending"
              />
            )}
            {ongoing.length > 0 && (
              <DrakorRow
                title="▶️ Sedang Berjalan"
                drakors={ongoing}
                href="/drakor/list/ongoing"
              />
            )}
          </div>
        </>
      ) : (
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="mb-6">
            <h1 className="text-2xl font-bold sm:text-3xl">Drakor</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tonton drama Korea subtitle Indonesia gratis.
            </p>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari drakor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <section className="mb-8">
            <h2 className="mb-4 text-lg font-bold">
              Hasil pencarian: {searchQuery}
            </h2>
            {searching ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {searchResults.map((d, idx) => (
                  <div key={d.id || idx} className="w-full">
                    <DrakorCard drakor={d} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada hasil.
              </p>
            )}
          </section>
        </div>
      )}

      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
