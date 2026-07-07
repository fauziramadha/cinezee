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
import { Loader2, AlertCircle, ArrowLeft, Play, Calendar, Tv, Star, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DonghuaDetailContentProps {
  slug: string;
  source: "s1" | "s2";
}

export function DonghuaDetailContent({ slug, source }: DonghuaDetailContentProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const endpoint = source === "s2"
      ? `/api/donghua/donghub/detail/${slug}`
      : `/api/anime/donghua/detail/${slug}`;
    fetch(endpoint)
      .then((res) => { 
        if (!res.ok) throw new Error(`HTTP ${res.status}`); 
        return res.json(); 
      })
      .then((json) => {
        if (json?.status === "error" || json?.message?.includes("Error")) {
          throw new Error(json?.message || "Donghua tidak ditemukan");
        }
        const raw = source === "s2" ? json?.data : json;
        if (raw) {
          const normalized = {
            title: raw.title || "Untitled",
            poster: raw.poster || raw.thumbnail || null,
            alter_title: raw.alter_title || null,
            rating: raw.rating || null,
            synopsis: raw.synopsis || "",
            genres: raw.genres || [],
            episodes_list: raw.episodes_list || raw.episodes || [],
            studio: raw.studio || raw.info?.studio || null,
            network: raw.network || raw.info?.network || null,
            released: raw.released || raw.info?.released || raw.released_on || raw.info?.released_on || null,
            type: raw.type || raw.info?.type || null,
            status: raw.status || raw.info?.status || "Unknown",
            duration: raw.duration || null,
            episodes_count: raw.episodes_count || raw.info?.episodes || null,
            season: raw.season || null,
            country: raw.country || raw.info?.country || null,
            updated_on: raw.updated_on || raw.info?.updated_on || null,
            batch_link: raw.batch_link || raw.batch || null,
          };
          setDetail(normalized);
        } else { throw new Error("Invalid response"); }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug, source]);

  if (loading) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }
  if (error || !detail) {
    return (<main className="min-h-screen bg-background"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-destructive" /><p className="text-sm text-destructive">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push("/donghua")} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }

  const title = detail.title;
  const poster = detail.poster;
  const status = detail.status;
  const isOngoing = status.toLowerCase().includes("ongoing");
  const episodeList = detail.episodes_list || [];
  const synopsisText = typeof detail.synopsis === "string" ? detail.synopsis : "";
  const genres = detail.genres || [];
  const watchBase = source === "s2" ? `/donghua/s2/watch` : `/donghua/s1/watch`;
  const genreBase = source === "s2" ? `/donghua/s2/genre` : `/donghua/s1/genre`;

  // FIX: Extract episode number from string like:
  // "Little Fairy Yao Episode 40 Tamat Subtitle Indonesia"
  // We use 3 strategies in order: pattern "Episode N", slug "episode-N", fallback any number
  const getEpNum = (ep: any, idx: number): string => {
    const rawValue = String(ep.episode || ep.title || ep.episode_name || "");
    const slugValue = String(ep.slug || "");

    // Strategy 1: Match "Episode <number>" pattern (case insensitive)
    const epMatch = rawValue.match(/episode\s+(\d+)/i);
    if (epMatch) return String(parseInt(epMatch[1], 10));

    // Strategy 2: Match "episode-<number>" in slug
    const slugMatch = slugValue.match(/episode-(\d+)/i);
    if (slugMatch) return String(parseInt(slugMatch[1], 10));

    // Strategy 3: Any number in the string
    const numMatch = rawValue.match(/\d+/);
    if (numMatch) return String(parseInt(numMatch[0], 10));

    // Last resort: index + 1
    return String(idx + 1);
  };

  // Sort key: extract episode number for sorting (ascending)
  const getSortKey = (ep: any): number => {
    const rawValue = String(ep.episode || ep.title || "");
    const slugValue = String(ep.slug || "");

    const epMatch = rawValue.match(/episode\s+(\d+)/i);
    if (epMatch) return parseInt(epMatch[1], 10);

    const slugMatch = slugValue.match(/episode-(\d+)/i);
    if (slugMatch) return parseInt(slugMatch[1], 10);

    const numMatch = rawValue.match(/\d+/);
    if (numMatch) return parseInt(numMatch[0], 10);

    return 0;
  };

  // Sort episode list ascending by parsed integer episode number
  const sortedEpisodes = [...episodeList].sort((a: any, b: any) => {
    return getSortKey(a) - getSortKey(b);
  });

  // After sorting, Episode 1 is always at index 0 for both servers
  const firstEpisode = sortedEpisodes[0];

  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <Header />
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted sm:h-[50vh]">
        {poster && <Image src={poster} alt={title} fill sizes="100vw" className="object-cover opacity-30 blur-sm scale-110" unoptimized priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      </div>
      <div className="container mx-auto -mt-32 px-4 pb-12 sm:-mt-40">
        <button onClick={() => router.push("/donghua")} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Kembali ke Donghua</button>
        <div className="mb-3"><span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white", source === "s2" ? "bg-purple-500/90" : "bg-blue-500/90")}>{source === "s2" ? "Server 2" : "Server 1"}</span></div>
        
        {/* Hero Section */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-2xl sm:mx-0 sm:w-48 md:w-56">
            {poster ? <Image src={poster} alt={title} fill sizes="(max-width: 640px) 160px, 224px" className="object-cover" unoptimized priority /> : <div className="flex h-full items-center justify-center text-muted-foreground"><Tv className="h-12 w-12" /></div>}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl break-words">{title}</h1>
            {detail.alter_title && <p className="mt-1 text-sm text-muted-foreground break-words">{detail.alter_title}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {detail.type && <Badge variant="secondary" className="gap-1"><Tv className="h-3 w-3" />{detail.type}</Badge>}
              <Badge variant="secondary" className={cn(isOngoing ? "border-green-500/40 text-green-400" : "border-blue-500/40 text-blue-400")}>{status}</Badge>
              {detail.rating && detail.rating !== "Rating 0.0" && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{detail.rating}</Badge>}
              {detail.duration && <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" />{detail.duration}</Badge>}
              {detail.episodes_count && <Badge variant="secondary">{detail.episodes_count} Episode</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {firstEpisode && <Button size="sm" onClick={() => router.push(`${watchBase}/${slug}/${firstEpisode.slug}`)} className="gap-2"><Play className="h-4 w-4 fill-current" />Tonton Episode 1</Button>}
              {detail.batch_link && <Button size="sm" variant="outline" className="gap-2"><Download className="h-4 w-4" />Download Batch</Button>}
            </div>
          </div>
        </div>

        {/* Content Grid: Mobile = 1 column (stacked), Desktop = 3 columns */}
        <div className="mt-8 flex flex-col gap-6 md:grid md:grid-cols-3">
          {/* Main Content (Synopsis + Episodes) */}
          <div className="md:col-span-2 min-w-0">
            {genres.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genre</h3>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g: any, idx: number) => <Link key={g.slug || idx} href={`${genreBase}/${g.slug || g.name?.toLowerCase()}`}><Badge variant="outline" className="cursor-pointer hover:border-primary hover:text-primary">{g.name || g.title}</Badge></Link>)}
                </div>
              </div>
            )}
            {synopsisText && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Synopsis</h3>
                <div className="space-y-2 text-sm leading-relaxed text-foreground/90" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {synopsisText.split("\n").filter((p: string) => p.trim()).map((p: string, idx: number) => <p key={idx}>{p}</p>)}
                </div>
              </div>
            )}
            {sortedEpisodes.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Episode ({sortedEpisodes.length})</h3>
                <div className="space-y-1.5">
                  {sortedEpisodes.map((ep: any, idx: number) => {
                    const epNum = getEpNum(ep, idx);
                    const epSlug = ep.slug || ep.episodeId || "";
                    return (
                      <Link key={epSlug || idx} href={`${watchBase}/${slug}/${epSlug}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{epNum}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Episode {epNum}</p>
                            {ep.date && <p className="flex items-center gap-1 text-[10px] text-muted-foreground" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Calendar className="h-2.5 w-2.5 shrink-0" />{ep.date}</p>}
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

          {/* Sidebar Info */}
          <div className="w-full md:space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi</h3>
              <dl className="space-y-2 text-xs">
                {detail.type && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Tipe</dt><dd className="font-medium text-right">{detail.type}</dd></div>}
                {detail.status && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd className="font-medium text-right">{detail.status}</dd></div>}
                {detail.episodes_count && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Total Episode</dt><dd className="font-medium text-right">{detail.episodes_count}</dd></div>}
                {detail.duration && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Durasi</dt><dd className="font-medium text-right">{detail.duration}</dd></div>}
                {detail.released && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Tayang</dt><dd className="font-medium text-right">{detail.released}</dd></div>}
                {detail.studio && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Studio</dt><dd className="font-medium text-right">{detail.studio}</dd></div>}
                {detail.network && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Network</dt><dd className="font-medium text-right">{detail.network}</dd></div>}
                {detail.country && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Negara</dt><dd className="font-medium text-right">{detail.country}</dd></div>}
                {detail.season && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Musim</dt><dd className="font-medium text-right">{detail.season}</dd></div>}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
