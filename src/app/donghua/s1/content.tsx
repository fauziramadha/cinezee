"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Flame, Tv, Globe, Sparkles, TrendingUp,
  ChevronLeft, ChevronRight, ArrowLeft, Loader2,
} from "lucide-react";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";

// ============================================================
// Types — adapt VPS FastAPI donghua items to MediaItem-like shape
// ============================================================
interface DonghuaItem {
  id: string;
  slug: string;
  title: string;
  poster: string;
  backdrop: string;
  overview: string;
  status: string;
  episode: string;
  type: string;
}

const SLIDE_DURATION = 7000;

// ============================================================
// Normalize VPS FastAPI items → DonghuaItem
// Format from API: { title, slug, url, poster, episode, status }
// ============================================================
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&#8217;": "'",
    "&#8216;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&#8211;": "-",
    "&#8212;": "—",
    "&#8230;": "...",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char);
  }
  // Also decode any remaining numeric entities like &#NNNN;
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

function normalizeItem(raw: any): DonghuaItem {
  const rawTitle = raw.title || raw.name || "Untitled";
  const title = decodeHtmlEntities(rawTitle.includes("\t") ? rawTitle.split("\t")[0] : rawTitle);
  const slug = (raw.slug || raw.id || "").toString().replace(/\/+$/, "").trim();
  const poster = raw.poster || raw.thumbnail || raw.image || raw.cover || "";
  return {
    id: slug,
    slug,
    title,
    poster,
    backdrop: poster, // donghua only has poster, use as backdrop too
    overview: raw.synopsis ? decodeHtmlEntities(raw.synopsis) : "",
    status: raw.status || (raw.completed ? "Completed" : "Ongoing") || "Ongoing",
    episode: raw.episode || raw.current_episode || "",
    type: raw.type || "TV",
  };
}

function normalizeList(list: any[]): DonghuaItem[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeItem);
}

// Extract series slug from episode slug
// e.g. "100-000-years-of-refining-qi-episode-355-subtitle-indonesia" → "100-000-years-of-refining-qi"
function extractSeriesSlug(episodeSlug: string): string {
  const match = episodeSlug.match(/^(.+)-episode-\d+-subtitle-indonesia$/);
  if (match) return match[1];
  return episodeSlug;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ============================================================
// Hero Carousel (matches movie homepage HeroCarousel style)
// ============================================================
function DonghuaHeroCarousel({ items, onPlay }: { items: DonghuaItem[]; onPlay: (item: DonghuaItem) => void }) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goToNext = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % items.length);
    setProgress(0);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + items.length) % items.length);
    setProgress(0);
  }, [items.length]);

  const goToSlide = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (isPaused || items.length === 0) return;
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        const np = prev + (50 / SLIDE_DURATION) * 100;
        return np >= 100 ? 100 : np;
      });
    }, 50);
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % items.length);
      setProgress(0);
    }, SLIDE_DURATION);
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, items.length, currentIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) goToNext();
    else if (touchEndX.current - touchStartX.current > 50) goToPrev();
    setIsPaused(false);
  };

  if (items.length === 0) return null;
  const current = items[currentIdx];

  return (
    <div
      className="relative h-[60vh] min-h-[400px] w-full overflow-hidden sm:h-[70vh] sm:min-h-[500px] touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: idx === currentIdx ? 1 : 0 }}
        >
          <img
            src={item.backdrop}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover pointer-events-none"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col justify-end p-4 pb-12 sm:p-10 sm:pb-14 md:p-14 md:pb-10 lg:p-16">
        <div className="max-w-2xl">
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:mb-3 sm:px-3 sm:py-1 sm:text-xs">
            <Flame className="h-3 w-3" /> Donghua
          </span>
          <h1 className="mb-2 text-2xl font-black leading-tight text-white drop-shadow-2xl sm:mb-3 sm:text-4xl md:text-5xl lg:text-7xl">
            {current.title}
          </h1>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:mb-3 sm:gap-3 sm:text-sm">
            {current.status && (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase text-white/80 sm:px-2">
                {current.status}
              </span>
            )}
            {current.episode && (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase text-white/80 sm:px-2">
                Ep {current.episode}
              </span>
            )}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] uppercase text-white/80 sm:px-2">
              Donghua
            </span>
          </div>
          {current.overview && (
            <p className="mb-3 max-w-xl text-xs text-white/80 line-clamp-2 sm:mb-5 sm:text-sm sm:line-clamp-3 md:text-base md:line-clamp-3 lg:text-lg">
              {current.overview}
            </p>
          )}
          <div className="flex flex-row gap-2 sm:gap-3">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 active:scale-95 sm:px-6 sm:py-2.5 sm:text-sm md:px-7 md:py-3 md:text-base"
            >
              <Play className="h-3.5 w-3.5 fill-white sm:h-4 sm:w-4 md:h-5 md:w-5" />
              <span className="whitespace-nowrap">Tonton Sekarang</span>
            </button>
            <button
              onClick={() => router.push(`/donghua/s1/${current.slug}`)}
              className="flex items-center justify-center gap-1.5 rounded-md bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95 sm:px-5 sm:py-2.5 sm:text-sm md:px-6 md:py-3 md:text-base"
            >
              <span className="whitespace-nowrap">Info Selengkapnya</span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 sm:bottom-4 md:bottom-6">
        <div className="flex gap-1.5 sm:gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-1 rounded-full transition-all ${idx === currentIdx ? "w-6 bg-white/30 sm:w-8" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
              aria-label={`Slide ${idx + 1}`}
            >
              {idx === currentIdx && (
                <div className="h-full rounded-full bg-red-600" style={{ width: `${progress}%` }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={goToPrev}
        className="absolute left-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 md:flex"
        aria-label="Previous slide"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 md:flex"
        aria-label="Next slide"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================
// Donghua Card (matches MovieCard style)
// ============================================================
function DonghuaCard({ item, onClick }: { item: DonghuaItem; onClick: (item: DonghuaItem) => void }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const title = item.title || "Untitled";
  const posterUrl = item.poster || "/placeholder-poster.png";

  return (
    <button
      onClick={() => onClick(item)}
      className="group relative w-[140px] shrink-0 overflow-hidden rounded-lg bg-card text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40 focus:outline-none sm:w-[160px] md:w-[180px]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted/60" />
        )}
        {posterUrl && !posterUrl.includes("placeholder") ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover transition-opacity duration-300 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-poster.png"; setImageLoaded(true); }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-xs">No Image</span>
          </div>
        )}

        {/* Status badge */}
        {item.status && (
          <div className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="text-[9px] font-semibold uppercase text-white/80">{item.status}</span>
          </div>
        )}

        {/* Episode badge */}
        {item.episode && (
          <div className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="text-[9px] font-semibold text-white">Ep {item.episode}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm transition group-hover:scale-110">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase text-white">
              Lihat Detail
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto bg-zinc-900 p-2">
        <h3 className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">{title}</h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/60">
          <span className="uppercase tracking-wide">Donghua</span>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// Section (matches movie homepage Section style)
// ============================================================
function DonghuaSection({
  title, icon, items, onItemClick, href,
}: {
  title: string;
  icon?: React.ReactNode;
  items: DonghuaItem[];
  onItemClick: (item: DonghuaItem) => void;
  href?: string;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          {icon}{title}
        </h2>
        <div className="flex items-center gap-2">
          {href && (
            <button
              onClick={() => router.push(href)}
              className="text-xs text-primary transition-colors hover:text-primary/80 sm:text-sm"
            >
              Lihat lebih banyak
            </button>
          )}
          <div className="hidden gap-1 sm:flex">
            <button
              onClick={() => scroll("left")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => (
          <DonghuaCard key={`${item.id}-${idx}`} item={item} onClick={onItemClick} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// Main DonghuaS1Content
// ============================================================
export function DonghuaS1Content() {
  const router = useRouter();
  const [hero, setHero] = useState<DonghuaItem[]>([]);
  const [latest, setLatest] = useState<DonghuaItem[]>([]);
  const [ongoing, setOngoing] = useState<DonghuaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [homeRes, ongoingRes] = await Promise.all([
          fetchJSON("/api/donghua/home").catch(() => null),
          fetchJSON("/api/donghua/ongoing?page=1").catch(() => null),
        ]);

        if (homeRes) {
          const popularList = normalizeList(homeRes.popular || []);
          const latestList = normalizeList(homeRes.latest || []).map((item) => ({
            ...item,
            // Extract series slug from episode slug so clicking goes to detail
            slug: extractSeriesSlug(item.slug),
            id: extractSeriesSlug(item.slug),
          }));
          const homeOngoing = normalizeList(homeRes.ongoing || []);

          if (popularList.length > 0) {
            setHero(popularList.slice(0, 5));
          } else if (latestList.length > 0) {
            setHero(latestList.slice(0, 5));
          }
          if (latestList.length > 0) setLatest(latestList);
          if (homeOngoing.length > 0 && !ongoingRes) setOngoing(homeOngoing);
        }

        if (ongoingRes) {
          const ongoingList = normalizeList(ongoingRes.items || []);
          if (ongoingList.length > 0) setOngoing(ongoingList);
        }
      } catch (err: any) {
        console.error("[Donghua] Load error:", err);
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePlay = useCallback((item: DonghuaItem) => {
    router.push(`/donghua/s1/${item.slug}`);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
              <div className="absolute inset-0 rounded-full border-2 border-t-red-600 animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-white/60">Memuat donghua...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-red-600/20 p-4">
            <Flame className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-lg font-semibold text-white">Gagal memuat donghua</p>
          <p className="max-w-md text-sm text-white/50">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {hero.length > 0 && (
        <DonghuaHeroCarousel items={hero} onPlay={handlePlay} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </button>

        <DonghuaSection
          title="Episode Terbaru"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          items={latest}
          onItemClick={handlePlay}
          href="/donghua/s1/list/latest"
        />

        <DonghuaSection
          title="Sedang Berjalan"
          icon={<Tv className="h-5 w-5 text-blue-500" />}
          items={ongoing}
          onItemClick={handlePlay}
          href="/donghua/s1/list/ongoing"
        />
      </div>

      <Footer />
    </div>
  );
}
