"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, List, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComicReaderProps {
  comicSlug: string;
  chapterNumber: string;
}

function ProxyImage({ src, alt, loading }: { src: string; alt: string; loading?: "eager" | "lazy" }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Strategy:
  // 0: Our proxy-image (primary, work for thumbnails)
  // 1: Direct URL with no-referrer
  // 2: Our proxy-image with cache bypass (retry)
  const sources = [
    `/api/proxy-image?url=${encodeURIComponent(src)}`,
    src,
    `/api/proxy-image?url=${encodeURIComponent(src)}&t=2`,
  ];

  if (attempt >= 3) {
    return (
      <div className="flex h-48 w-full items-center justify-center bg-muted text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <ImageOff className="h-8 w-8" />
          <p className="text-xs">Gagal memuat gambar</p>
          <button
            onClick={() => { setAttempt(0); setLoaded(false); }}
            className="text-xs text-primary hover:underline"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-muted">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[attempt]}
        alt={alt}
        className={`h-auto w-full transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading={loading}
        referrerPolicy={attempt === 1 ? "no-referrer" : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setAttempt(prev => prev + 1);
        }}
      />
    </div>
  );
}

export function ComicReader({ comicSlug, chapterNumber }: ComicReaderProps) {
  const router = useRouter();
  const [chapterData, setChapterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/comic/view/" + comicSlug + "/" + chapterNumber)
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((json) => {
        const raw = json?.success ? json : json?.data;
        if (raw && (raw.images || raw.image_list || raw.pages)) {
          setChapterData(raw);
        } else if (json?.images) {
          setChapterData(json);
        } else {
          throw new Error("Chapter tidak ditemukan");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [comicSlug, chapterNumber]);

  if (loading) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }
  if (error || !chapterData) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push("/comic/" + comicSlug)} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }

  const title = chapterData.mangaTitle || chapterData.manga_title || chapterData.title || chapterData.comic_title || "Comic";
  const chapterTitle = chapterData.chapterTitle || chapterData.chapter_title || chapterData.chapter || chapterData.name || ("Chapter " + chapterNumber);
  
  // CRITICAL: Indocast returns images as array of objects
  // { src, fallbackSrc, url_proxy, fallbackSrc_proxy, alt, id }
  // 
  // Strategy: prefer `src` (direct komiku URL) + our own proxy-image route
  // (same approach as comic-card.tsx that works for thumbnails).
  // Avoid `url_proxy` (Indocast proxy) karena sering 522/error per kata admin.
  const rawImages = chapterData.images || chapterData.image_list || chapterData.pages || [];
  const images: string[] = rawImages.map((img: any) => {
    if (typeof img === "string") return img;
    // Prioritize direct `src` (komiku URL) - akan dipass ke proxy-image kita
    return img.src || img.fallbackSrc || img.url_proxy || img.fallbackSrc_proxy || "";
  }).filter((url: string) => url);

  const nav = chapterData.navigation || chapterData.nav || {};

  // Defensive navigation: handle berbagai nama field
  const prevChapterObj = nav.prevChapter || nav.previous || nav.prev_chapter || nav.previousChapter;
  const nextChapterObj = nav.nextChapter || nav.next_chapter || nav.nextChapter;
  
  const prevChapter = prevChapterObj ? (typeof prevChapterObj === "string" ? prevChapterObj : prevChapterObj.chapter) : null;
  const nextChapter = nextChapterObj ? (typeof nextChapterObj === "string" ? nextChapterObj : nextChapterObj.chapter) : null;

  const buildReaderUrl = (ch: string) => "/comic/read/" + comicSlug + "/" + ch;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 pt-20">
        <button onClick={() => router.push("/comic/" + comicSlug)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kembali ke Daftar Chapter
        </button>
        
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{chapterTitle}</p>
        </div>

        <div className="mx-auto max-w-3xl space-y-1">
          {images.map((imgUrl: string, idx: number) => (
            <ProxyImage
              key={idx}
              src={imgUrl}
              alt={"Page " + (idx + 1)}
              loading={idx < 3 ? "eager" : "lazy"}
            />
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => prevChapter && router.push(buildReaderUrl(prevChapter))}
            disabled={!prevChapter}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/comic/" + comicSlug)}
            className="gap-1.5"
          >
            <List className="h-4 w-4" />
            Daftar Chapter
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => nextChapter && router.push(buildReaderUrl(nextChapter))}
            disabled={!nextChapter}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
