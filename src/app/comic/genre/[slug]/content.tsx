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

// Normalize Indocast Komiku shape
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
    views: item.views || undefined,
    description: item.description || undefined,
  }));
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.status === "error" || res.statusCode) return res;
  return res;
}

interface ComicGenreContentProps {
  slug: string;
}

export function ComicGenreContent({ slug }: ComicGenreContentProps) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Capitalize genre name for display (e.g. "action" → "Action")
  const genreName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint: /api/comic/populer?genre=<slug>&page=<n>
      const endpoint = "/api/comic/populer?genre=" + encodeURIComponent(slug) + "&page=" + pageNum;
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();

      const inner = unwrap(json);
      const rawList = inner?.items || [];
      const list = normalizeKomiku(rawList);

      setItems(list);
      const hasNext = inner?.hasNext ?? list.length >= 10;
      setHasNextPage(hasNext);
    } catch (err) {
      console.error("[ComicGenre] error:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

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

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <button onClick={() => router.push("/comic")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kembali ke Komik
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">Genre: {genreName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Halaman {page}</p>
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
            <p className="text-sm text-muted-foreground">Tidak ada komik untuk genre ini.</p>
          </div>
        )}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
