"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ComicCard } from "@/components/comic/comic-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface ComicListContentProps {
  type: string;
}

export function ComicListContent({ type }: ComicListContentProps) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      let rawList: any[] = [];
      let hasMore = false;

      if (type === "manga" || type === "manhwa" || type === "manhua") {
        // Fetch 2 pages from pustaka to get ~20 items, then filter to get enough for 1 page (15 items)
        const [res1, res2] = await Promise.all([
          fetch(`/api/comic/pustaka/${pageNum * 2 - 1}`),
          fetch(`/api/comic/pustaka/${pageNum * 2}`),
        ]);

        const json1 = res1.ok ? await res1.json() : {};
        const json2 = res2.ok ? await res2.json() : {};

        const allResults = [
          ...(json1?.results || []),
          ...(json2?.results || []),
        ];

        const filtered = allResults.filter(
          (item: any) => (item.type || "").toLowerCase() === type.toLowerCase()
        );

        // Take top 15 for the current page
        rawList = filtered.slice(0, 15);
        
        // Check if there are more items
        const hasMorePustaka = json1?.pagination?.has_more || json2?.pagination?.has_more;
        hasMore = hasMorePustaka || filtered.length > 15;
      } else {
        // Fetch from terbaru/populer/trending with pagination
        const res = await fetch(`/api/comic/${type}?page=${pageNum}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (type === "trending") {
          rawList = json?.trending || [];
        } else {
          rawList = json?.comics || [];
        }

        // Use API pagination info if available
        hasMore = json?.pagination?.has_more ?? rawList.length >= 10;
      }

      const list = normalize(rawList);
      setItems(list);
      setHasNextPage(hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [loadData]);

  const handlePrevPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      loadData(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      const newPage = page + 1;
      setPage(newPage);
      loadData(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const titleMap: Record<string, string> = {
    terbaru: "Terbaru",
    populer: "Populer",
    trending: "Trending",
    manga: "Manga",
    manhwa: "Manhwa",
    manhua: "Manhua",
  };

  const pageTitle = titleMap[type] || "Komik";

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <button onClick={() => router.push("/comic")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kembali ke Komik
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Komik {pageTitle}</h1>
        </div>

        {loading && <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        
        {error && !loading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => loadData(page)}>Coba lagi</Button>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {items.map((c) => <ComicCard key={c.slug} comic={c} />)}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page === 1 || loading} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <span className="px-3 text-sm font-medium text-muted-foreground">Halaman {page}</span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage || loading} className="gap-1.5">
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">Tidak ada komik untuk kategori ini.</p>
          </div>
        )}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
