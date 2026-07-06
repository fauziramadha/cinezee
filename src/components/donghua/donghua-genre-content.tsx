"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DonghuaGenreContentProps {
  slug: string;
  source: "s1" | "s2";
}

export function DonghuaGenreContent({ slug, source }: DonghuaGenreContentProps) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadData = useCallback(async (pageNum: number) => {
    setLoading(true); setError(null);
    try {
      const endpoint = source === "s2"
        ? `/api/donghua/donghub/genre/${slug}/${pageNum}`
        : `/api/donghua/donghua/genres/${slug}/${pageNum}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // S1: flat or data array, S2: wrapped in data
      const rawList = source === "s2"
        ? (json?.data || (Array.isArray(json) ? json : []))
        : (json?.data || json?.donghuaList || (Array.isArray(json) ? json : []));
      const list = rawList.map((item: any) => ({ ...item, slug: (item.slug || "").replace(/\/$/, ""), source }));
      setItems(list);
      setHasNextPage(source === "s2" ? (json?.pagination?.has_next ?? list.length >= 10) : list.length >= 10);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [slug, source]);

  useEffect(() => { setPage(1); loadData(1); }, [loadData]);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <button onClick={() => router.push("/donghua")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kembali</button>
        <div className="mb-6"><h1 className="text-2xl font-bold sm:text-3xl">Genre: {slug.charAt(0).toUpperCase() + slug.slice(1)}</h1></div>
        {loading && <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        {error && !loading && <div className="flex h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="secondary" size="sm" onClick={() => loadData(page)}>Coba lagi</Button></div>}
        {!loading && !error && items.length > 0 && (<>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">{items.map((d) => <DonghuaCard key={d.slug} donghua={d} />)}</div>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { if (page > 1) { const n = page - 1; setPage(n); loadData(n); window.scrollTo({ top: 0, behavior: "smooth" }); } }} disabled={page === 1 || loading} className="gap-1.5"><ChevronLeft className="h-4 w-4" />Prev</Button>
            <span className="px-3 text-sm font-medium text-muted-foreground">Halaman {page}</span>
            <Button variant="outline" size="sm" onClick={() => { if (hasNextPage) { const n = page + 1; setPage(n); loadData(n); window.scrollTo({ top: 0, behavior: "smooth" }); } }} disabled={!hasNextPage || loading} className="gap-1.5">Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </>)}
        {!loading && !error && items.length === 0 && <div className="flex h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-muted-foreground">Tidak ada donghua untuk genre ini.</p><Button variant="secondary" size="sm" onClick={() => router.push("/donghua")}>Kembali</Button></div>}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
