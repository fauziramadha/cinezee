"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, Film, Tv, Clock, Flame,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { MovieCard } from "@/components/cinepro/movie-card";

const TMDB_PROXY = "/api/tmdb";
const TMDB_IMG = "https://image.tmdb.org/t/p";

interface MediaItem {
  id: string;
  tmdbId: number;
  imdbId?: string;
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  logo?: string;
  overview: string;
  year: string;
  rating: number;
  genre?: string;
  seasons?: Array<{ seasonNumber: number; episodeCount: number; name?: string }>;
}

interface EpisodeItem {
  showTmdbId: number;
  showImdbId: string | null;
  showTitle: string;
  season: string;
  episode: string;
  episodeTitle: string;
  airDate: string;
  embedUrl: string;
  still?: string;
  overview?: string;
}

function imgUrl(path?: string | null, size: string = "w342"): string {
  if (!path) return "/placeholder-poster.png";
  if (path.startsWith("http")) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

async function tmdbFetch(path: string): Promise<any | null> {
  try {
    const r = await fetch(`${TMDB_PROXY}${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ============================================================
// Fetch VidAPI latest (PAKAI DATA LANGSUNG - super cepat)
// ============================================================
async function fetchVidapiLatest(type: "movie" | "tv", maxItems = 15): Promise<MediaItem[]> {
  const endpoint = type === "movie" ? "movies" : "tvshows";
  try {
    const r = await fetch(`https://vidapi.ru/${endpoint}/latest/page-1.json`);
    if (!r.ok) return [];
    const data = await r.json();
    const items = (data.items || [])
      .filter((item: any) => item.imdb_id && item.poster_url)
      .slice(0, maxItems);

    return items.map((item: any) => ({
      id: item.imdb_id,
      tmdbId: parseInt(item.tmdb_id, 10) || 0,
      imdbId: item.imdb_id,
      title: item.title || "Untitled",
      type,
      poster: item.poster_url.replace("/original/", "/w342/").replace("/w500/", "/w342/"),
      backdrop: item.poster_url.replace("/original/", "/w1280/").replace("/w500/", "/w1280/"),
      overview: "",
      year: item.year || "",
      rating: parseFloat(item.rating) || 0,
      genre: item.genre || undefined,
    } as MediaItem));
  } catch { return []; }
}

// ============================================================
// Enrich hero items dengan TMDB logo (async, tidak block render)
// ============================================================
async function enrichHeroItems(items: MediaItem[]): Promise<MediaItem[]> {
  const batchSize = 5;
  const results: MediaItem[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const enriched = await Promise.all(
      batch.map(async (item) => {
        if (!item.tmdbId) return item;
        const detail = await tmdbFetch(
          `/${item.type}/${item.tmdbId}?append_to_response=external_ids,images&include_image_language=en,null`
        );
        if (!detail) return item;
        const logo = detail.images?.logos?.find((l: any) => l.iso_639_1 === "en")
                  || detail.images?.logos?.[0];
        return {
          ...item,
          backdrop: detail.backdrop_path ? imgUrl(detail.backdrop_path, "w1280") : item.backdrop,
          overview: detail.overview || item.overview,
          logo: logo ? imgUrl(logo.file_path, "w500") : undefined,
          rating: detail.vote_average || item.rating,
          seasons: item.type === "tv" && detail.seasons
            ? detail.seasons.filter((s: any) => s.season_number > 0).map((s: any) => ({
                seasonNumber: s.season_number,
                episodeCount: s.episode_count,
                name: s.name,
              }))
            : item.seasons,
        } as MediaItem;
      })
    );
    results.push(...enriched);
  }
  return results;
}

// ============================================================
// Fetch TMDB popular (tanpa filter VidAPI - untuk speed)
// ============================================================
async function fetchTMDBPopular(type: "movie" | "tv", maxItems = 15): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/${type}/popular`);
  if (!data?.results) return [];
  return data.results
    .filter((m: any) => m.poster_path)
    .slice(0, maxItems)
    .map((m: any) => ({
      id: `tmdb-${m.id}`,
      tmdbId: m.id,
      imdbId: undefined,
      title: m.title || m.name || "Untitled",
      type,
      poster: imgUrl(m.poster_path, "w342"),
      backdrop: imgUrl(m.backdrop_path, "w1280"),
      overview: m.overview || "",
      year: (m.release_date || m.first_air_date || "").slice(0, 4),
      rating: m.vote_average || 0,
      genre: m.genre_ids?.length ? String(m.genre_ids[0]) : undefined,
    } as MediaItem));
}

// ============================================================
// Fetch latest episodes (VidAPI + TMDB stills)
// ============================================================
async function fetchLatestEpisodes(maxItems = 15): Promise<EpisodeItem[]> {
  try {
    const r = await fetch("https://vidapi.ru/episodes/latest/page-1.json");
    if (!r.ok) return [];
    const data = await r.json();
    const eps = (data.items || [])
      .filter((e: any) => e.show_imdb_id && e.show_tmdb_id)
      .slice(0, maxItems);

    // Fetch stills async (batch 5)
    const batchSize = 5;
    const result: EpisodeItem[] = [];
    for (let i = 0; i < eps.length; i += batchSize) {
      const batch = eps.slice(i, i + batchSize);
      const enriched = await Promise.all(
        batch.map(async (ep: any) => {
          const item: EpisodeItem = {
            showTmdbId: parseInt(ep.show_tmdb_id, 10) || 0,
            showImdbId: ep.show_imdb_id,
            showTitle: ep.show_title,
            season: ep.season_number,
            episode: ep.episode_number,
            episodeTitle: ep.episode_title,
            airDate: ep.air_date,
            embedUrl: ep.embed_url,
          };
          if (item.showTmdbId > 0) {
            const data = await tmdbFetch(
              `/tv/${item.showTmdbId}/season/${item.season}/episode/${item.episode}`
            );
            if (data) {
              if (data.still_path) item.still = imgUrl(data.still_path, "w300");
              if (data.overview) item.overview = data.overview;
            }
          }
          return item;
        })
      );
      result.push(...enriched);
    }
    return result;
  } catch { return []; }
}

export default function HomePage() {
  const { setPlayerMedia, setDetailMedia } = useAppStore();

  const [heroItems, setHeroItems] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTvShows] = useState<MediaItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        console.log("[Home] Start loading...");
        const startTime = Date.now();

        // === PHASE 1: FAST - 3 VidAPI calls paralel (~500ms) ===
        const [vidapiMovies, vidapiTV, vidapiEps] = await Promise.all([
          fetchVidapiLatest("movie", 15),
          fetchVidapiLatest("tv", 15),
          fetchLatestEpisodes(15),
        ]);

        setMovies(vidapiMovies);
        setTvShows(vidapiTV);
        setEpisodes(vidapiEps);

        // === STOP LOADING - tampilkan konten sekarang juga ===
        setLoading(false);
        console.log(`[Home] Phase 1 done in ${Date.now() - startTime}ms - content visible`);

        // === PHASE 2: ASYNC (background) - enrich hero + popular ===
        // Pakai top 10 dari VidAPI movies untuk hero
        if (vidapiMovies.length > 0) {
          const top10 = vidapiMovies.slice(0, 10);
          enrichHeroItems(top10).then(enriched => {
            setHeroItems(enriched);
            console.log(`[Home] Hero enriched in ${Date.now() - startTime}ms`);
          });
        }

        // Fetch popular movies di background
        fetchTMDBPopular("movie", 15).then(pop => {
          setPopularMovies(pop);
          console.log(`[Home] Popular movies in ${Date.now() - startTime}ms`);
        });

      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load");
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePlay = useCallback((item: MediaItem) => {
    if (!item.imdbId) {
      alert("Film ini tidak memiliki IMDB ID, tidak bisa diputar.");
      return;
    }
    setPlayerMedia({
      id: item.imdbId,
      imdbId: item.imdbId,
      tmdbId: item.tmdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      seasons: item.seasons,
    });
  }, [setPlayerMedia]);

  const handleDetail = useCallback((item: MediaItem) => {
    setDetailMedia({
      id: item.imdbId || item.id,
      tmdbId: item.tmdbId,
      imdbId: item.imdbId,
      title: item.title,
      type: item.type,
      poster: item.poster,
      backdrop: item.backdrop,
      overview: item.overview,
      year: item.year,
      rating: item.rating,
      seasons: item.seasons,
    });
  }, [setDetailMedia]);

  const handlePlayEpisode = useCallback((ep: EpisodeItem) => {
    if (!ep.showImdbId) return;
    setPlayerMedia({
      id: ep.showImdbId,
      imdbId: ep.showImdbId,
      tmdbId: ep.showTmdbId,
      title: `${ep.showTitle} - S${ep.season}E${ep.episode}`,
      type: "tv",
      poster: "",
      backdrop: "",
      overview: ep.overview || ep.episodeTitle,
      year: (ep.airDate || "").slice(0, 4),
      rating: 0,
      seasons: [{
        seasonNumber: parseInt(ep.season) || 1,
        episodeCount: parseInt(ep.episode) || 1,
        name: `Season ${ep.season}`,
      }],
      _currentSeason: ep.season,
      _currentEpisode: ep.episode,
    } as any);
  }, [setPlayerMedia]);

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
            <p className="text-sm font-medium text-white/60">Memuat film terbaru...</p>
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
          <p className="text-lg font-semibold text-white">Gagal memuat konten</p>
          <p className="max-w-md text-sm text-white/50">{error}</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {heroItems.length > 0 && (
        <HeroCarousel items={heroItems} onPlay={handlePlay} onMoreInfo={handleDetail} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Section
          title="Film Terbaru"
          icon={<Film className="h-5 w-5 text-red-500" />}
          items={movies}
          onItemClick={handleDetail}
        />

        <Section
          title="Film Populer"
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          items={popularMovies}
          onItemClick={handleDetail}
        />

        <Section
          title="Series Terbaru"
          icon={<Tv className="h-5 w-5 text-purple-500" />}
          items={tvShows}
          onItemClick={handleDetail}
        />

        {episodes.length > 0 && (
          <EpisodeSection episodes={episodes} onPlay={handlePlayEpisode} />
        )}
      </div>

      <Footer />
    </div>
  );
}

// ============================================================
// SECTION (horizontal scroll)
// ============================================================
function Section({ title, icon, items, onItemClick }: {
  title: string;
  icon?: React.ReactNode;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
}) {
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
          {icon}
          {title}
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => (
          <MovieCard key={`${item.id}-${idx}`} item={item} onClick={onItemClick} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// EPISODE SECTION (horizontal scroll)
// ============================================================
function EpisodeSection({ episodes, onPlay }: {
  episodes: EpisodeItem[];
  onPlay: (ep: EpisodeItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl md:text-2xl">
          <Clock className="h-5 w-5 text-blue-500" />
          Episode Terbaru
        </h2>
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {episodes.map((e, i) => (
          <EpisodeCard
            key={`${e.showTmdbId}-${e.season}-${e.episode}-${i}`}
            episode={e}
            onClick={() => onPlay(e)}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// EPISODE CARD
// ============================================================
function EpisodeCard({ episode, onClick }: { episode: EpisodeItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-[200px] shrink-0 flex-col gap-2 rounded-md bg-zinc-900 p-2 text-left transition hover:bg-zinc-800 sm:w-[240px]"
    >
      <div className="relative aspect-video overflow-hidden rounded bg-zinc-800">
        {episode.still ? (
          <img
            src={episode.still}
            alt={`${episode.showTitle} S${episode.season}E${episode.episode}`}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 fill-white/80 text-white/80" />
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          S{episode.season}E{episode.episode}
        </span>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <Play className="h-8 w-8 fill-white text-white" />
        </div>
      </div>
      <div>
        <p className="line-clamp-1 text-xs font-medium text-white">{episode.showTitle}</p>
        <p className="line-clamp-1 text-[10px] text-white/50">{episode.episodeTitle}</p>
        <p className="mt-0.5 text-[10px] text-white/40">{episode.airDate}</p>
      </div>
    </button>
  );
}
