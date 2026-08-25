"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DonghuaHero } from "@/components/donghua/donghua-hero";
import { DonghuaRow } from "@/components/donghua/donghua-row";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================================
// Normalize list items from VPS FastAPI
// Format: { title, slug, url, poster, episode, status }
// ============================================================
function normalizeList(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => {
    const rawTitle = item.title || item.name || "Untitled";
    const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
    const slug = (item.slug || item.id || "").toString().replace(/\/+$/, "").trim();
    const poster = item.poster || item.thumbnail || item.image || item.cover || item.img || null;
    const status = item.status || item.type || (item.completed ? "Completed" : "Ongoing") || "Ongoing";
    const current_episode = item.episode || item.current_episode || item.latest_episode || "";
    return {
      title,
      slug,
      poster,
      status,
      current_episode: current_episode ? String(current_episode) : "",
      type: item.type || "TV",
      source: "s1" as const,
    };
  });
}

// Extract series slug from episode slug
// e.g. "100-000-years-of-refining-qi-episode-355-subtitle-indonesia" → "100-000-years-of-refining-qi"
function extractSeriesSlug(episodeSlug: string): string {
  const match = episodeSlug.match(/^(.+)-episode-\d+-subtitle-indonesia$/);
  if (match) return match[1];
  return episodeSlug;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export function DonghuaS1Content() {
  const [hero, setHero] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [latest, setLatest] = useState<any[]>([]);
  const [ongoing, setOngoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch home (popular + latest + ongoing) and separate ongoing page
        const [homeRes, ongoingRes] = await Promise.all([
          fetchJSON("/api/donghua/home").catch((e) => {
            console.error("[Donghua] home error:", e);
            return null;
          }),
          fetchJSON("/api/donghua/ongoing?page=1").catch((e) => {
            console.error("[Donghua] ongoing error:", e);
            return null;
          }),
        ]);

        if (homeRes) {
          // Home format: { popular: [5], latest: [20], ongoing: [12] }
          const popularList = Array.isArray(homeRes.popular) ? homeRes.popular : [];
          const latestList = Array.isArray(homeRes.latest) ? homeRes.latest : [];
          const homeOngoing = Array.isArray(homeRes.ongoing) ? homeRes.ongoing : [];

          const popularNorm = normalizeList(popularList);
          const latestNorm = normalizeList(latestList).map((item) => ({
            ...item,
            // Extract series slug from episode slug so clicking goes to detail
            slug: extractSeriesSlug(item.slug),
          }));

          if (popularNorm.length > 0) {
            setPopular(popularNorm);
            setHero(popularNorm.slice(0, 5));
          } else if (latestNorm.length > 0) {
            // Fallback: use latest as hero if no popular
            setHero(latestNorm.slice(0, 5));
          }
          if (latestNorm.length > 0) setLatest(latestNorm);
          if (homeOngoing.length > 0 && !ongoingRes) {
            setOngoing(normalizeList(homeOngoing));
          }
        }

        // Ongoing page format: { items: [30], pagination: {...} }
        if (ongoingRes) {
          const ongoingList = Array.isArray(ongoingRes.items) ? ongoingRes.items : [];
          const ongoingNorm = normalizeList(ongoingList);
          if (ongoingNorm.length > 0) setOngoing(ongoingNorm);
        }
      } catch (err) {
        console.error("Failed to load donghua home:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const keyword = encodeURIComponent(searchQuery.trim());
        const res = await fetchJSON(`/api/donghua/search?q=${keyword}&page=1`).catch(() => null);
        if (res) {
          // Search format: { items: [...], pagination: {...}, query: "..." }
          const list = Array.isArray(res.items) ? res.items : (Array.isArray(res) ? res : []);
          setSearchResults(normalizeList(list));
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
          {hero.length > 0 && <DonghuaHero donghuas={hero} source="s1" />}

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

            {popular.length > 0 && (
              <DonghuaRow
                title="🔥 Terpopuler Hari Ini"
                donghuas={popular}
                href="/donghua/s1/list/popular"
                source="s1"
              />
            )}
            {latest.length > 0 && (
              <DonghuaRow
                title="📺 Episode Terbaru"
                donghuas={latest}
                href="/donghua/s1/list/latest"
                source="s1"
              />
            )}
            {ongoing.length > 0 && (
              <DonghuaRow
                title="▶️ Sedang Berjalan"
                donghuas={ongoing}
                href="/donghua/s1/list/ongoing"
                source="s1"
              />
            )}
          </div>
        </>
      ) : (
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="mb-6">
            <h1 className="text-2xl font-bold sm:text-3xl">Donghua</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tonton donghua (anime China) gratis. Server 1 - Anichin.
            </p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari donghua..."
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
                  <div key={d.slug || idx} className="w-full">
                    <DonghuaCard
                      donghua={{
                        title: d.title,
                        poster: d.poster,
                        slug: d.slug,
                        status: d.status,
                        current_episode: d.current_episode,
                        type: d.type,
                        source: "s1",
                      }}
                    />
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
