"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ComicHero } from "@/components/comic/comic-hero";
import { ComicRow } from "@/components/comic/comic-row";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

function extractSlug(link: string): string {
  if (!link) return "";
  let path = link.replace(/^https?:\/\/[^/]+/, "");
  path = path.replace(/^\/(manga|detail-komik|baca-chapter)\//, "");
  path = path.replace(/\/$/, "").split("/")[0];
  return path;
}

function normalize(list: any[]): any[] {
  return list.map((item: any) => ({
    title: item.title || "Untitled",
    slug: item.slug || extractSlug(item.link || item.href || item.url || item.detailUrl || ""),
    thumbnail: item.thumbnail || item.image || item.poster || null,
    image: item.image || item.thumbnail || item.poster || null,
    type: item.type || "Manga",
    genre: item.genre || undefined,
    chapter: item.chapter || undefined,
  }));
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

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch basic endpoints
        const [terbaruRes, populerRes, trendingRes] = await Promise.all([
          fetch(`/api/comic/terbaru`),
          fetch(`/api/comic/populer`),
          fetch(`/api/comic/trending`),
        ]);

        const terbaruJson = await terbaruRes.json();
        const populerJson = await populerRes.json();
        const trendingJson = await trendingRes.json();

        setTerbaru(normalize(terbaruJson?.comics || []));
        setPopuler(normalize(populerJson?.comics || []));
        setTrending(normalize(trendingJson?.trending || []));

        // Fetch pustaka for manga/manhwa/manhua (limit 2 pages for home preview)
        const [pustaka1Res, pustaka2Res] = await Promise.all([
          fetch(`/api/comic/pustaka/1`),
          fetch(`/api/comic/pustaka/2`),
        ]);

        const pustaka1Json = await pustaka1Res.json();
        const pustaka2Json = await pustaka2Res.json();
        const allPustaka = [
          ...(pustaka1Json?.results || []),
          ...(pustaka2Json?.results || []),
        ];

        setManga(normalize(allPustaka.filter((item: any) => (item.type || "").toLowerCase() === "manga")));
        setManhwa(normalize(allPustaka.filter((item: any) => (item.type || "").toLowerCase() === "manhwa")));
        setManhua(normalize(allPustaka.filter((item: any) => (item.type || "").toLowerCase() === "manhua")));

      } catch (err) {
        console.error("Failed to load comic home:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const showSearch = searchQuery.trim().length > 0;
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/comic/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        setSearchResults(normalize(json?.data || []));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] items-center justify-center pt-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
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
              <a href="/" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80">
                <ArrowLeft className="h-4 w-4" />Kembali ke Beranda
              </a>
            </div>

            <ComicRow title="🔥 Terbaru" comics={terbaru} href="/comic/list/terbaru" />
            <ComicRow title="📈 Trending" comics={trending} href="/comic/list/trending" />
            <ComicRow title="⭐ Populer" comics={populer} href="/comic/list/populer" />
            
            {manga.length > 0 && <ComicRow title="📖 Manga" comics={manga} href="/comic/list/manga" />}
            {manhwa.length > 0 && <ComicRow title="🇰🇷 Manhwa" comics={manhwa} href="/comic/list/manhwa" />}
            {manhua.length > 0 && <ComicRow title="🇨🇳 Manhua" comics={manhua} href="/comic/list/manhua" />}
          </div>
        </>
      ) : (
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
          
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-bold">Hasil pencarian: &quot;{searchQuery}&quot;</h2>
            {searching ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {searchResults.map((c) => (
                  <ComicCard key={c.slug} comic={c} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada hasil.</p>
            )}
          </section>
        </div>
      )}

      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}

// Import ComicCard di sini agar tersedia untuk search results
import { ComicCard } from "@/components/comic/comic-card";
