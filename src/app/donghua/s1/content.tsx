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
import { s1 } from "@/lib/donghua-api";

// Anichin API item shape (verified):
// { title, slug, poster, status, type, current_episode, href, anichinUrl }
function normalizeS1List(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => {
    const rawTitle = item.title || item.name || "Untitled";
    const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
    const slug =
      item.slug ||
      (item.id || "").toString() ||
      (item.link || item.url || item.href || "")
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/^\/(anime|donghua|detail|episode)\//, "")
        .replace(/\/$/, "")
        .split("/")[0] ||
      "";
    const poster =
      item.poster ||
      item.thumbnail ||
      item.image ||
      item.cover ||
      item.img ||
      null;
    const status =
      item.status ||
      item.type ||
      item.state ||
      (item.completed ? "Completed" : "Ongoing");
    const current_episode =
      item.current_episode ||
      item.episode ||
      item.latest_episode ||
      item.uploaded_episode ||
      item.total_episode ||
      "";
    return {
      title,
      slug: slug.toString().replace(/\/$/, ""),
      poster,
      status,
      current_episode: current_episode ? String(current_episode) : "",
      type: item.type || "TV",
      source: "s1" as const,
    };
  });
}

function pickArray(obj: any, keys: string[]): any[] {
  if (!obj) return [];
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  return [];
}

export function DonghuaS1Content() {
  const [hero, setHero] = useState<any[]>([]);
  const [latest, setLatest] = useState<any[]>([]);
  const [ongoing, setOngoing] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Home endpoint shape (verified):
        // { status, creator, latest_release: [...20], completed_donghua: [...45] }
        const homeRes = await s1.getHome(1).catch((e) => {
          console.error("[Donghua s1] getHome error:", e);
          return null;
        });

        if (homeRes) {
          const latestList = pickArray(homeRes, ["latest_release", "latest", "new_release"]);
          const latestNormalized = normalizeS1List(latestList);
          if (latestNormalized.length > 0) setLatest(latestNormalized);
          if (latestNormalized.length > 0) setHero(latestNormalized.slice(0, 5));

          const completedList = pickArray(homeRes, [
            "completed_donghua",
            "completed",
            "complete",
          ]);
          const completedNormalized = normalizeS1List(completedList);
          if (completedNormalized.length > 0) setCompleted(completedNormalized);
        }

        // Ongoing endpoint shape (verified):
        // { status, creator, ongoing_donghua: [...20] }
        const ongoingRes = await s1.getOngoing(1).catch(() => null);
        if (ongoingRes) {
          const ongoingList = pickArray(ongoingRes, [
            "ongoing_donghua",
            "ongoing",
            "on_going",
          ]);
          const ongoingNormalized = normalizeS1List(ongoingList);
          if (ongoingNormalized.length > 0) setOngoing(ongoingNormalized);
        }
      } catch (err) {
        console.error("Failed to load donghua s1 home:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Search endpoint shape (verified):
  // { creator, data: [...10] }
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await s1.search(searchQuery.trim(), 1).catch(() => null);
        if (res) {
          const list = pickArray(res, ["data", "items", "results", "list", "search"]);
          setSearchResults(normalizeS1List(list));
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

            {latest.length > 0 && (
              <DonghuaRow
                title="🔥 Episode Terbaru"
                donghuas={latest}
                source="s1"
                isEpisode
              />
            )}
            {ongoing.length > 0 && (
              <DonghuaRow
                title="▶️ Sedang Berjalan"
                donghuas={ongoing}
                source="s1"
              />
            )}
            {completed.length > 0 && (
              <DonghuaRow
                title="✅ Tamat"
                donghuas={completed}
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
              Tonton donghua (anime China) gratis. Server 1 — Anichin.
            </p>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari donghua... (misal: Soul Land, Battle Through the Heavens)"
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
              Hasil pencarian: &quot;{searchQuery}&quot;
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
