"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { ComicCard } from "@/components/comic/comic-card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function extractSlug(link: string): string {
  if (!link) return "";
  let path = link.replace(/^https?:\/\/[^/]+/, "");
  path = path.replace(/^\/(manga|detail-komik)\//, "");
  return path.replace(/\/$/, "");
}

export function ComicGenreContent({ slug }: { slug: string }) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/comic/genre/${slug}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        const rawList = json?.data || json?.comics || (Array.isArray(json) ? json : []);
        const list = rawList.map((item: any) => ({
          ...item,
          slug: item.slug || extractSlug(item.link || item.href || ""),
          thumbnail: item.thumbnail || item.image || item.poster || null,
          image: item.image || item.thumbnail || item.poster || null,
        }));
        setItems(list);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <button onClick={() => router.push("/comic")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kembali</button>
        <div className="mb-6"><h1 className="text-2xl font-bold sm:text-3xl">Genre: {slug.charAt(0).toUpperCase() + slug.slice(1)}</h1></div>
        {loading && <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
        {error && !loading && <div className="flex h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="secondary" size="sm" onClick={() => router.push("/comic")}>Kembali</Button></div>}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((c) => <ComicCard key={c.slug} comic={c} />)}
          </div>
        )}
        {!loading && !error && items.length === 0 && <div className="flex h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-muted-foreground">Tidak ada komik untuk genre ini.</p></div>}
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
