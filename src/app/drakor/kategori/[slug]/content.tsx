"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

interface DrakorKategoriViewProps {
  slug: string;
  page: number;
  items: any[];
  total: number;
  allKategori: Array<{ id: string; title: string; count: number }>;
}

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

export function DrakorKategoriView({
  slug,
  page,
  items,
  total,
  allKategori,
}: DrakorKategoriViewProps) {
  const router = useRouter();
  const [showAllKategori, setShowAllKategori] = useState(false);

  // Cari title kategori saat ini
  const currentKategori = allKategori.find((k) => k.id === slug);
  const currentTitle = currentKategori?.title || slug;

  // Normalize items
  const normalizedItems = normalizeDrakor(items);

  // Pagination: total items / 10 per page
  const hasNextPage = total > page * 10 || normalizedItems.length >= 10;

  const handlePrevPage = () => {
    if (page > 1) {
      router.push(`/drakor/kategori/${slug}?page=${page - 1}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      router.push(`/drakor/kategori/${slug}?page=${page + 1}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Back button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/drakor");
            }
          }}
          className="mb-4 gap-1.5 shadow-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Button>

        {/* Title */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold sm:text-3xl">Kategori: {currentTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} drakor • Halaman {page}
          </p>
        </div>

        {/* Kategori chips (quick switch) */}
        {allKategori.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowAllKategori(!showAllKategori)}
              className="mb-2 text-xs text-primary hover:underline"
            >
              {showAllKategori ? "▼ Sembunyikan kategori" : "▶ Lihat semua kategori"}
            </button>
            {showAllKategori && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
                {allKategori.map((k) => (
                  <Link
                    key={k.id}
                    href={`/drakor/kategori/${k.id}`}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      k.id === slug
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {k.title} ({k.count})
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid drakor */}
        {normalizedItems.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {normalizedItems.map((d, idx) => (
                <div key={d.id || idx} className="w-full">
                  <DrakorCard drakor={d} />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page <= 1}
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
                disabled={!hasNextPage}
                className="gap-1.5"
              >
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada drakor di kategori ini.
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
