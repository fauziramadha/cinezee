"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComicReaderProps {
  chapterSlug: string;
}

export function ComicReader({ chapterSlug }: ComicReaderProps) {
  const router = useRouter();
  const [chapterData, setChapterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/comic/chapter/${chapterSlug}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (json?.images) {
          setChapterData(json);
        } else {
          throw new Error("Chapter tidak ditemukan");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [chapterSlug]);

  if (loading) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }
  if (error || !chapterData) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push("/comic")} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }

  const title = chapterData.manga_title || "Comic";
  const chapterTitle = chapterData.chapter_title || "Chapter";
  const images = chapterData.images || [];
  const nav = chapterData.navigation || {};

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 pt-20">
        <button onClick={() => nav.chapterList ? router.push(`/comic/${nav.chapterList}`) : router.push("/comic")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Kembali ke Daftar Chapter
        </button>
        
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{chapterTitle}</p>
        </div>

        {/* Reader: Vertical scroll, images stacked */}
        {/* Using standard <img> tag to fully bypass hotlink protection with referrerPolicy */}
        <div className="mx-auto max-w-3xl space-y-1">
          {images.map((imgUrl: string, idx: number) => (
            <div key={idx} className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt={`Page ${idx + 1}`}
                className="h-auto w-full"
                loading={idx < 2 ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>

        {/* Navigation Controls */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => nav.previousChapter && router.push(`/comic/read/${nav.previousChapter}`)}
            disabled={!nav.previousChapter}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => nav.chapterList ? router.push(`/comic/${nav.chapterList}`) : router.push("/comic")}
            className="gap-1.5"
          >
            <List className="h-4 w-4" />
            Daftar Chapter
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => nav.nextChapter && router.push(`/comic/read/${nav.nextChapter}`)}
            disabled={!nav.nextChapter}
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
