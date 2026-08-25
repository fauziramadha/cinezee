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
import { Loader2, AlertCircle, ArrowLeft, Play, Calendar, Tv, Star, Download, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DonghuaDetailContentProps {
  slug: string;
  source: "s1" | "s2";
}

function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&#8217;": "'", "&#8216;": "'", "&#8220;": '"', "&#8221;": '"',
    "&#8211;": "-", "&#8212;": "—", "&#8230;": "...", "&amp;": "&",
    "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

export function DonghuaDetailContent({ slug, source }: DonghuaDetailContentProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllGenres, setShowAllGenres] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Both s1 and s2 use the same VPS FastAPI endpoint now
    const endpoint = `/api/donghua/detail/${slug}`;
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.status === "error" || json?.message?.includes("Error")) {
          throw new Error(json?.message || "Donghua tidak ditemukan");
        }
        // VPS FastAPI detail format:
        // { title, slug, poster, synopsis, rating, genres: [{name,slug}], status, type, episodes: [], total_episodes }
        if (json) {
          const normalized = {
            title: decodeHtmlEntities(json.title || "Untitled"),
            poster: json.poster || json.thumbnail || null,
            alter_title: json.alter_title ? decodeHtmlEntities(json.alter_title) : null,
            rating: json.rating ? String(json.rating) : null,
            synopsis: json.synopsis ? decodeHtmlEntities(json.synopsis) : "",
            genres: Array.isArray(json.genres) ? json.genres.map((g: any) => ({
              ...g,
              name: g.name ? decodeHtmlEntities(g.name) : g.name,
            })) : [],
            episodes_list: Array.isArray(json.episodes) ? json.episodes : [],
            studio: json.studio || null,
            network: json.network || null,
            released: json.released || null,
            type: json.type || null,
            status: json.status || "Unknown",
            duration: json.duration || null,
            episodes_count: json.total_episodes || json.episodes_count || null,
            season: json.season || null,
            country: json.country || null,
            subber: json.subber || null,
            updated_on: json.updated_on || null,
            batch_link: json.batch_link || null,
          };
          setDetail(normalized);
        } else {
          throw new Error("Invalid response");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug, source]);

  if (loading) {
    return (<main className="min-h-screen bg-black"><Header /><div className="flex h-[60vh] items-center justify-center pt-20"><Loader2 className="h-10 w-10 animate-spin text-red-600" /></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }
  if (error || !detail) {
    return (<main className="min-h-screen bg-black"><Header /><div className="flex h-[60vh] flex-col items-center justify-center gap-3 pt-20 text-center"><AlertCircle className="h-10 w-10 text-red-500" /><p className="text-sm text-red-400">{error || "Tidak ditemukan"}</p><Button variant="secondary" size="sm" onClick={() => router.push("/donghua")} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" />Kembali</Button></div><Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal /></main>);
  }

  const title = detail.title;
  const poster = detail.poster;
  const status = detail.status;
  const isOngoing = status.toLowerCase().includes("ongoing");
  const episodeList = detail.episodes_list || [];
  const synopsisText = typeof detail.synopsis === "string" ? detail.synopsis : "";
  const genres = detail.genres || [];
  const watchBase = `/donghua/s1/watch`;
  const genreBase = `/donghua/s1/genre`;

  // FIX: Extract episode number from string like:
  // "Little Fairy Yao Episode 40 Tamat Subtitle Indonesia"
  // We use 4 strategies: field "number", pattern "Episode N", slug "episode-N", fallback any number
  const getEpNum = (ep: any, idx: number): string => {
    // Strategy 0: Use "number" field if present (from VPS FastAPI)
    if (ep.number !== undefined && ep.number !== null && ep.number !== "") {
      return String(ep.number);
    }

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
    if (ep.number !== undefined && ep.number !== null && ep.number !== "") {
      const n = parseInt(ep.number, 10);
      if (!isNaN(n)) return n;
    }

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
    <main className="min-h-screen bg-black overflow-hidden">
      <Header />
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-zinc-900 sm:h-[50vh]">
        {poster && <Image src={poster} alt={title} fill sizes="100vw" className="object-cover opacity-30 blur-sm scale-110" unoptimized priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      </div>
      <div className="container mx-auto -mt-32 px-4 pb-12 sm:-mt-40">
        <button onClick={() => router.push("/donghua")} className="mb-4 flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Kembali ke Donghua</button>

        {/* Hero Section */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg bg-zinc-800 shadow-2xl sm:mx-0 sm:w-48 md:w-56">
            {poster ? <Image src={poster} alt={title} fill sizes="(max-width: 640px) 160px, 224px" className="object-cover" unoptimized priority /> : <div className="flex h-full items-center justify-center text-white/30"><Tv className="h-12 w-12" /></div>}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl break-words">{title}</h1>
            {detail.alter_title && <p className="mt-1 text-sm text-white/60 break-words">{detail.alter_title}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {detail.type && <Badge variant="secondary" className="gap-1 bg-white/10 text-white"><Tv className="h-3 w-3" />{detail.type}</Badge>}
              <Badge variant="secondary" className={cn(isOngoing ? "border-green-500/40 text-green-400" : "border-blue-500/40 text-blue-400", "bg-white/10")}>{status}</Badge>
              {detail.rating && detail.rating !== "Rating 0.0" && <Badge variant="secondary" className="gap-1 bg-white/10 text-white"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{detail.rating}</Badge>}
              {detail.duration && <Badge variant="secondary" className="gap-1 bg-white/10 text-white"><Calendar className="h-3 w-3" />{detail.duration}</Badge>}
              {detail.episodes_count && <Badge variant="secondary" className="bg-white/10 text-white">{detail.episodes_count} Episode</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {firstEpisode && <Button size="sm" onClick={() => router.push(`${watchBase}/${slug}/${firstEpisode.slug}`)} className="gap-2 bg-red-600 text-white hover:bg-red-700"><Play className="h-4 w-4 fill-current" />Tonton Episode 1</Button>}
              {detail.batch_link && <Button size="sm" variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10"><Download className="h-4 w-4" />Download Batch</Button>}
            </div>
          </div>
        </div>

        {/* Content Grid: Mobile = 1 column (stacked), Desktop = 3 columns */}
        <div className="mt-8 flex flex-col gap-6 md:grid md:grid-cols-3">
          {/* Main Content (Synopsis + Episodes) */}
          <div className="md:col-span-2 min-w-0">
            {genres.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Genre</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllGenres ? genres : genres.slice(0, 5)).map((g: any, idx: number) => (
                    <Link key={g.slug || idx} href={`${genreBase}/${g.slug || g.name?.toLowerCase()}`}>
                      <Badge variant="outline" className="cursor-pointer border-white/20 text-white/80 hover:border-red-500 hover:text-red-400">{g.name || g.title}</Badge>
                    </Link>
                  ))}
                </div>
                {genres.length > 5 && (
                  <button
                    onClick={() => setShowAllGenres(!showAllGenres)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-500 transition hover:text-red-400"
                  >
                    {showAllGenres ? "Tampilkan lebih sedikit" : `Selengkapnya (+${genres.length - 5})`}
                    <ChevronDown className={`h-3 w-3 transition-transform ${showAllGenres ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
            )}
            {synopsisText && (
              <div className="mb-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Synopsis</h3>
                <div className="space-y-2 text-sm leading-relaxed text-white/90" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {synopsisText.split("\n").filter((p: string) => p.trim()).map((p: string, idx: number) => <p key={idx}>{p}</p>)}
                </div>
              </div>
            )}
            {sortedEpisodes.length > 0 && (
              <div className="min-w-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Episode ({sortedEpisodes.length})</h3>
                <div className="space-y-1.5">
                  {sortedEpisodes.map((ep: any, idx: number) => {
                    const epNum = getEpNum(ep, idx);
                    const epSlug = ep.slug || ep.episodeId || "";
                    return (
                      <Link key={epSlug || idx} href={`${watchBase}/${slug}/${epSlug}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900 p-3 transition-all hover:border-red-500 hover:bg-red-600/5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/10 text-xs font-bold text-red-500">{epNum}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Episode {epNum}</p>
                            {ep.date && <p className="flex items-center gap-1 text-[10px] text-white/40" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Calendar className="h-2.5 w-2.5 shrink-0" />{ep.date}</p>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="w-full md:space-y-4">
            <div className="rounded-lg border border-white/10 bg-zinc-900 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">Informasi</h3>
              <dl className="space-y-2 text-xs">
                {detail.type && <div className="flex justify-between gap-2"><dt className="text-white/50">Tipe</dt><dd className="font-medium text-right text-white">{detail.type}</dd></div>}
                {detail.status && <div className="flex justify-between gap-2"><dt className="text-white/50">Status</dt><dd className="font-medium text-right text-white">{detail.status}</dd></div>}
                {detail.episodes_count && <div className="flex justify-between gap-2"><dt className="text-white/50">Total Episode</dt><dd className="font-medium text-right text-white">{detail.episodes_count}</dd></div>}
                {detail.duration && <div className="flex justify-between gap-2"><dt className="text-white/50">Durasi</dt><dd className="font-medium text-right text-white">{detail.duration}</dd></div>}
                {detail.released && <div className="flex justify-between gap-2"><dt className="text-white/50">Tayang</dt><dd className="font-medium text-right text-white">{detail.released}</dd></div>}
                {detail.studio && <div className="flex justify-between gap-2"><dt className="text-white/50">Studio</dt><dd className="font-medium text-right text-white">{detail.studio}</dd></div>}
                {detail.network && <div className="flex justify-between gap-2"><dt className="text-white/50">Network</dt><dd className="font-medium text-right text-white">{detail.network}</dd></div>}
                {detail.country && <div className="flex justify-between gap-2"><dt className="text-white/50">Negara</dt><dd className="font-medium text-right text-white">{detail.country}</dd></div>}
                {detail.season && <div className="flex justify-between gap-2"><dt className="text-white/50">Musim</dt><dd className="font-medium text-right text-white">{detail.season}</dd></div>}
                {detail.subber && <div className="flex justify-between gap-2"><dt className="text-white/50">Subber</dt><dd className="font-medium text-right text-white">{detail.subber}</dd></div>}
              </dl>
            </div>
          </div>
        </div>
      </div>
      <Footer /><SearchModal /><DetailModal /><PlayerModal /><AuthModal />
    </main>
  );
}
