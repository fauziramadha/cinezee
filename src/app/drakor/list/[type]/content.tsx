"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DrakorCard } from "@/components/drakor/drakor-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  if (res.data !== undefined && res.code !== undefined) return res.data;
  return res;
}

const TYPE_CONFIG: Record<
  string,
  { title: string; endpoint: (page: number) => string }
> = {
  terbaru: {
    title: "Drakor Terbaru",
    endpoint: (page) => "/api/drakor/terbaru?page=" + page,
  },
  ongoing: {
    title: "Sedang Berjalan",
    endpoint: (page) => "/api/drakor/ongoing?page=" + page,
  },
  trending: {
    title: "Trending",
    endpoint: (page) => "/api/drakor/trending" + (page > 1 ? "?page=" + page : ""),
  },
};

interface DrakorListContentProps {
  type: string;
  page: number;
}

export function DrakorListContent({ type, page }: DrakorListContentProps) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const config = TYPE_CONFIG[type];

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      if (!config) {
        setError("Tipe tidak valid");
        setLoading(false);
        return;
      }
      const res = await fetch(config.endpoint(pageNum), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const inner = unwrap(json);
      // FIX: Trending pakai hari_ini/minggu_ini/bulan_ini (bukan items)
      const rawList =
        inner?.items ||
        inner?.hari_ini ||
        inner?.minggu_ini ||
        inner?.bulan_ini ||
        [];
      const list = normalizeDrakor(rawList);
      setItems(list);
      // DrakorID: { total: 30 } - kalau ada total, hitung hasNext
      const total = inner?.total || 0;
      const hasNext = total > pageNum * 10 || list.length >= 10;
      setHasNextPage(hasNext);
    } catch (err) {
      console.error("[DrakorList] error:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [type, config]);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  const handlePrevPage = () => {
    if (page > 1) {
      router.push("/drakor/list/" + type + "?page=" + (page - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      router.push("/drakor/list/" + type + "?page=" + (page + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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

  if (error || !config) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center">
          <p className="text-sm text-destructive">{error || "Tipe tidak valid"}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push("/drakor")}>
            <ArrowLeft className="h-3.5 w-3.5" />Kembali
          </Button>
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
      <div className="container mx-auto px-4 py-8 pt-24">
        <Link
          href="/drakor"
          className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Drakor
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Halaman {page}</p>
        </div>

        {items.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {items.map((d, idx) => (
                <div key={d.id || idx} className="w-full">
                  <DrakorCard drakor={d} />
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page <= 1 || loading}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <span className="px-3 text-sm font-medium text-muted-foreground">
                Halaman {page}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage || loading}
                className="gap-1.5"
              >
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada drakor di halaman ini.
          </p>
        )}
      </div>
      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
