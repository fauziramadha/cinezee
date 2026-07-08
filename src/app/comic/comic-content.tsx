"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ComicHero } from "@/components/comic/comic-hero";
import { ComicRow } from "@/components/comic/comic-row";
import { ComicCard } from "@/components/comic/comic-card";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

// Normalize new Indocast Komiku shape → format yang dipakai ComicCard
// New shape: { title, slug, thumbnail, type, genre, views, latestChapter, chapterNumber, isColored, description }
function normalizeKomiku(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => ({
    title: item.title || "Untitled",
    slug: (item.slug || "").toString().replace(/\/+$/, "").trim(),
    thumbnail: item.thumbnail || item.image || null,
    image: item.thumbnail || item.image || null,
    type: item.type || "Manga",
    genre: item.genre || undefined,
    chapter: item.latestChapter || item.chapterNumber || item.chapter || undefined,
  }));
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.status === "error" || res.statusCode) return res;
  return res;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export function ComicContent() {
  const [terbaru, setTerbaru] = useState<any[]>([]);
  const [populer, setPopuler] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [manga, setManga] = useState<any[]>([]);
  const [manhwa, setManhwa] = useState<any[]>([]);
  const [manhua, setManhua] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Populer adalah endpoint yang paling stabil (home & terbaru sering 522)
        // Pakai populer sebagai sumber utama untuk hero + populer + trending
        const populerRes = await fetchJSON("/api/comic/populer?page=1").catch(() => null);

        let populerItems: any[] = [];
        if (populerRes) {
          const inner = unwrap(populerRes);
          populerItems = normalizeKomiku(inner?.items || []);
        }

        if (populerItems.length > 0) {
          setPopuler(populerItems);
          // Hero pakai 5 item pertama dari populer
          // Trending pakai item dengan views tertinggi (sort by views desc)
          setTrending(
            [...populerItems]
              .sort((a, b) => {
                const va = parseFloat(String(a.views || "0").replace(/[^\d.]/g, "")) || 0;
                const vb = parseFloat(String(b.views || "0").replace(/[^\d.]/g, "")) || 0;
                return vb - va;
              })
              .slice(0, 10)
          );
        }

        // Coba fetch terbaru, kalau 522 fallback ke populer
        const terbaruRes = await fetchJSON("/api/comic/terbaru?page=1").catch(() => null);
        if (terbaruRes) {
          const inner = unwrap(terbaruRes);
          const items = normalizeKomiku(inner?.items || []);
          if (items.length > 0) {
            setTerbaru(items);
          } else {
            setTerbaru(populerItems);
          }
        } else {
          // Fallback: pakai populer sebagai terbaru
          setTerbaru(populerItems);
        }

        // Coba fetch home untuk dapat data tambahan
        const homeRes = await fetchJSON("/api/comic/home").catch(() => null);
        if (homeRes) {
          const inner = unwrap(homeRes);
          // Home mungkin punya struktur berbeda, coba pick array dari berbagai key
          const homeItems = normalizeKomiku(
            inner?.items || inner?.terbaru || inner?.populer || inner?.data || []
          );
          if (homeItems.length > 0 && terbaru.length === 0) {
            setTerbaru(homeItems);
          }
        }

        // Klasifikasi berdasarkan type (Manga/Manhwa/Manhua)
        // Filter dari populer + terbaru yang sudah ada
        const allItems = [...populerItems, ...terbaru];
        const seen = new Set<string>();
        const unique = allItems.filter((item) => {
          if (seen.has(item.slug)) return false;
          seen.add(item.slug);
          return true;
        });

        const mangaList = unique.filter((item) =>
          (item.type || "").toLowerCase().includes("manga")
        );
        const manhwaList = unique.filter((item) =>
          (item.type || "").toLowerCase().includes("manhwa")
        );
        const manhuaList = unique.filter((item) =>
          (item.type || "").toLowerCase().includes("manhua")
        );

        if (mangaList.length > 0) setManga(mangaList);
        if (manhwaList.length > 0) setManhwa(manhwaList);
        if (manhuaList.length > 0) setManhua(manhuaList);
      } catch (err) {
        console.error("Failed to load comic home:", err);
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
          "/api/comic/search?q=" + encodeURIComponent(searchQuery.trim())
        ).catch(() => null);
        if (res) {
          const inner = unwrap(res);
          const list = inner?.items || inner?.data || [];
          setSearchResults(normalizeKomiku(list));
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
          {terbaru.length > 0 && <ComicHero comics={terbaru} />}

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

          {terbaru.length > 0 && <ComicRow title="🔥 Terbaru" comics={terbaru} href="/comic/list/terbaru" />}
          {trending.length > 0 && <ComicRow title="📈 Trending" comics={trending} href="/comic/list/trending" />}
          {populer.length > 0 && <ComicRow title="⭐ Populer" comics={populer} href="/comic/list/populer" />}
          {manga.length > 0 && <ComicRow title="📖 Manga" comics={manga} href="/comic/list/manga" />}
          {manhwa.length > 0 && <ComicRow title="🇰🇷 Manhwa" comics={manhwa} href="/comic/list/manhwa" />}
          {manhua.length > 0 && <ComicRow title="🇨🇳 Manhua" comics={manhua} href="/comic/list/manhua" />}
          </div>
        </>
      ) : (
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="mb-6">
            <h1 className="text-2xl font-bold sm:text-3xl">Komik</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Baca manga, manhwa, manhua gratis. Update tiap hari.
            </p>
          </div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari komik..."
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
                {searchResults.map((c, idx) => (
                  <ComicCard key={c.slug || idx} comic={c} />
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
