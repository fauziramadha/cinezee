"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { SearchModal } from "@/components/cinepro/search-modal";
import { DetailModal } from "@/components/cinepro/detail-modal";
import { PlayerModal } from "@/components/cinepro/player-modal";
import { AuthModal } from "@/components/cinepro/auth-modal";
import { Loader2, AlertCircle, ArrowLeft, BookOpen, User, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ComicDetailContentProps {
  slug: string;
}

export function ComicDetailContent({ slug }: ComicDetailContentProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/comic/comic/${slug}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json) => {
        if (json?.title) {
          setDetail(json);
        } else {
          throw new Error("Komik tidak ditemukan");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }
  if (error || !detail) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push("/comic")} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }

  const title = detail.title;
  const poster = detail.image;
  const synopsis = detail.synopsis || detail.synopsis_full || detail.summary || "";
  const genres = detail.genres || [];
  const chapters = detail.chapters || [];
  const meta = detail.metadata || {};

  // Sort chapters ascending by chapter number
  const sortedChapters = [...chapters].sort((a, b) => {
    const numA = parseInt((a.chapter || "").match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt((b.chapter || "").match(/\d+/)?.[0] || "0", 10);
    return numA - numB;
  });

  const firstChapter = sortedChapters[0];

  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <Header />
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted sm:h-[50vh]">
        {poster && <Image src={poster} alt={title} fill sizes="100vw" className="object-cover opacity-30 blur-sm scale-110" unoptimized priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="container mx-auto -mt-32 px-4 pb-12 sm:-mt-40">
        <button onClick={() => router.push("/comic")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kembali ke Komik</button>
        
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-56">
            {poster ? <Image src={poster} alt={title} fill sizes="(max-width: 640px) 160px, 224px" className="object-cover" unoptimized priority /> : <div className="flex h-full items-center justify-center text-muted-foreground"><BookOpen className="h-12 w-12" /></div>}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl break-words">{title}</h1>
            {detail.title_indonesian && <p className="mt-1 text-sm text-muted-foreground break-words">{detail.title_indonesian}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {meta.type && <Badge variant="secondary">{meta.type}</Badge>}
              {meta.status && <Badge variant="secondary">{meta.status}</Badge>}
              {meta.author && <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" />{meta.author}</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {firstChapter && <Button size="sm" onClick={() => router.push(`/comic/read/${firstChapter.slug}`)} className="gap-2"><BookOpen className="h-4 w-4" />Baca Chapter 1</Button>}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 md:grid md:grid-cols-3">
          <div className="md:col-span-2 min-w-0">
            {genres.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genre</h3>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g: any, idx: number) => <Link key={g.slug || idx} href={`/comic/genre/${g.slug}`}><Badge variant="outline" className="cursor-pointer hover:border-primary hover:text-primary">{g.name}</Badge></Link>)}
                </div>
              </div>
            )}
            {synopsis && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Synopsis</h3>
                <div className="space-y-2 text-sm leading-relaxed text-foreground/90" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {synopsis.split("\n").filter((p: string) => p.trim()).map((p: string, idx: number) => <p key={idx}>{p}</p>)}
                </div>
              </div>
            )}
            {sortedChapters.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chapter ({sortedChapters.length})</h3>
                <div className="max-h-[500px] space-y-1.5 overflow-y-auto pr-2">
                  {sortedChapters.map((ch: any, idx: number) => {
                    const chSlug = ch.slug || "";
                    const chTitle = ch.chapter || `Chapter ${idx + 1}`;
                    return (
                      <Link key={chSlug || idx} href={`/comic/read/${chSlug}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chTitle}</p>
                            {ch.date && <p className="flex items-center gap-1 text-[10px] text-muted-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Calendar className="h-2.5 w-2.5 shrink-0" />{ch.date}</p>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="w-full md:space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi</h3>
              <dl className="space-y-2 text-xs">
                {meta.type && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Tipe</dt><dd className="font-medium text-right">{meta.type}</dd></div>}
                {meta.status && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd className="font-medium text-right">{meta.status}</dd></div>}
                {meta.author && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Author</dt><dd className="font-medium text-right">{meta.author}</dd></div>}
                {meta.concept && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Konsep</dt><dd className="font-medium text-right">{meta.concept}</dd></div>}
                {meta.age_rating && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Umur</dt><dd className="font-medium text-right">{meta.age_rating}</dd></div>}
                {meta.reading_direction && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Arah Baca</dt><dd className="font-medium text-right">{meta.reading_direction}</dd></div>}
                {sortedChapters.length > 0 && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Total Chapter</dt><dd className="font-medium text-right">{sortedChapters.length}</dd></div>}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
