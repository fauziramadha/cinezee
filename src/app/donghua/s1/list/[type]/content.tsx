"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { DonghuaCard } from "@/components/donghua/donghua-card";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function normalizeS1List(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => {
    const rawTitle = item.title || item.name || "Untitled";
    const title = rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle;
    let slug =
      item.slug ||
      (item.id || "").toString() ||
      (item.link || item.url || item.href || "")
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/^\/(anime|donghua|detail|episode)\//, "")
        .replace(/\/$/, "")
        .split("/")[0] ||
      "";
    // CRITICAL: strip trailing slash from slug (API returns "xxx/")
    slug = slug.toString().replace(/\/+$/, "").trim();
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
      slug,
      poster,
      status,
      current_episode: current_episode ? String(current_episode) : "",
      type: item.type || "TV",
      source: "s1" as const,
    };
  });
}

function extractSeriesSlug(episodeSlug: string): string {
  const match = episodeSlug.match(/^(.+)-episode-\d+-subtitle-indonesia$/);
  if (match) return match[1];
  return episodeSlug;
}

function pickArray(obj: any, keys: string[]): any[] {
  if (!obj) return [];
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  return [];
}

function unwrap(res: any): any {
  if (!res) return null;
  if (res.status === "error" || res.statusCode) return res;
  if (res.data !== undefined) return res.data;
  return res;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// VPS FastAPI endpoints — response format: { items: [...], pagination: {current_page, max_page, has_next} }
const TYPE_CONFIG: Record<
  string,
  { title: string; endpoint: (page: number) => string }
> = {
  latest: {
    title: "Episode Terbaru",
    endpoint: (page) => `/api/donghua/latest?page=${page}`,
  },
  ongoing: {
    title: "Sedang Berjalan",
    endpoint: (page) => `/api/donghua/ongoing?page=${page}`,
  },
  completed: {
    title: "Tamat",
    endpoint: (page) => `/api/donghua/completed?page=${page}`,
  },
  popular: {
    title: "Terpopuler",
    endpoint: (page) => `/api/donghua/popular?page=${page}`,
  },
};

interface DonghuaS1ListContentProps {
  type: string;
  page: number;
}

export function DonghuaS1ListContent({ type, page }: DonghuaS1ListContentProps) {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = TYPE_CONFIG[type];

  useEffect(() => {
    if (!config) {
      setError("Tipe tidak valid");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchJSON(config.endpoint(page))
      .then((res) => {
        // VPS FastAPI format: { items: [...], pagination: {...} }
        const list = Array.isArray(res.items) ? res.items : (Array.isArray(res) ? res : []);
        let normalized = normalizeS1List(list);
        // For latest, extract series slug so click goes to detail page
        if (type === "latest") {
          normalized = normalized.map((item) => ({
            ...item,
            slug: extractSeriesSlug(item.slug),
          }));
        }
        setItems(normalized);
      })
      .catch((err) => {
        console.error("[Donghua s1 list] error:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [type, page, config]);

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
          <Button variant="secondary" size="sm" onClick={() => router.push("/donghua")}>
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
        <div className="mb-6">
          <Link
            href="/donghua"
            className="mb-3 inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Donghua
          </Link>
          <h1 className="text-2xl font-bold sm:text-3xl">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Halaman {page}
          </p>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((d, idx) => (
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
            Tidak ada donghua di halaman ini.
          </p>
        )}

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() =>
              router.push("/donghua/s1/list/" + type + "?page=" + (page - 1))
            }
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Halaman {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={items.length < 10}
            onClick={() =>
              router.push("/donghua/s1/list/" + type + "?page=" + (page + 1))
            }
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Footer />
      <SearchModal />
      <DetailModal />
      <PlayerModal />
      <AuthModal />
    </main>
  );
}
