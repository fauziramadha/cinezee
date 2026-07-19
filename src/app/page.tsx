"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, Film, Tv, Clock,
  ChevronLeft, ChevronRight, Flame,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";
import { HeroCarousel } from "@/components/cinepro/hero-carousel";
import { MovieCard } from "@/components/cinepro/movie-card";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
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
  return `${TMDB_IMG}/${size}${path}`;
}

async function fetchVidapiIds(type: "movie" | "tv", pages = 5): Promise<Set<string>> {
  const endpoint = type === "movie" ? "movies" : "tvshows";
  const ids = new Set<string>();
  await Promise.all(
    Array.from({ length: pages }, (_, i) => i + 1).map(async (page) => {
      try {
        const r = await fetch(`https://vidapi.ru/${endpoint}/latest/page-${page}.json`);
        if (!r.ok) return;
        const data = await r.json();
        (data.items || []).forEach((item: any) => {
          if (item.tmdb_id) ids.add(String(item.tmdb_id));
        });
      } catch {}
    })
  );
  return ids;
}

async function fetchTMDB(endpoint: string): Promise<any[]> {
  if (!TMDB_KEY) return [];
  try {
    const r = await fetch(`${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&language=en-US&page=1`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.results || [];
  } catch { return []; }
}

async function enrichItem(tmdbId: number, type: "movie" | "tv"): Promise<any | null> {
  if (!TMDB_KEY || !tmdbId) return null;
  try {
    const r = await fetch(
      `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=external_ids,images&include_image_language=en,null`
    );
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchFilteredMedia(type: "movie" | "tv"): Promise<MediaItem[]> {
  const vidapiIds = await fetchVidapiIds(type, 5);

  const endpoints = type === "movie"
    ? ["/movie/now_playing", "/movie/popular"]
    : ["/tv/popular", "/tv/airing_today"];

  const [list1, list2] = await Promise.all(endpoints.map(fetchTMDB));

  const seen = new Set<number>();
  const merged = [...list1, ...list2]
    .filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  const available = merged.filter(m => vidapiIds.has(String(m.id)));

  const top = available.slice(0, 30);
  const enriched = await Promise.all(
    top.map(async (m) => {
      const detail = await enrichItem(m.id, type);
      const logo = detail?.images?.logos?.find((l: any) => l.iso_639_1 === "en")
                || detail?.images?.logos?.[0];
      return {
        id: detail?.external_ids?.imdb_id || `tmdb-${m.id}`,
        tmdbId: m.id,
        imdbId: detail?.external_ids?.imdb_id,
        title: m.title || m.name || "Untitled",
        type,
        poster: imgUrl(m.poster_path, "w342"),
        backdrop: imgUrl(m.backdrop_path, "w1280"),
        logo: logo ? imgUrl(logo.file_path, "w500") : undefined,
        overview: m.overview || "",
        year: (m.release_date || m.first_air_date || "").slice(0, 4),
        rating: m.vote_average || 0,
        genre: m.genre_ids?.length ? String(m.genre_ids[0]) : undefined,
        seasons: type === "tv" && detail?.seasons
          ? detail.seasons
              .filter((s: any) => s.season_number > 0)
              .map((s: any) => ({
                seasonNumber: s.season_number,
                episodeCount: s.episode_count,
                name: s.name,
              }))
          : undefined,
      } as MediaItem;
    })
  );

  return enriched;
}

async function fetchLatestEpisodesWithStills(): Promise<EpisodeItem[]> {
  try {
    const r = await fetch("https://vidapi.ru/episodes/latest/page-1.json");
    if (!r.ok) return [];
    const data = await r.json();
    const eps = (data.items || [])
      .filter((e: any) => e.show_imdb_id && e.show_tmdb_id)
      .slice(0, 24);

    const batchSize = 10;
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
          if (TMDB_KEY && item.showTmdbId > 0) {
            try {
              const r = await fetch(
                `${TMDB_BASE}/tv/${item.showTmdbId}/season/${item.season}/episode/${item.episode}?api_key=${TMDB_KEY}&language=en-US`
              );
              if (r.ok) {
                const data = await r.json();
                if (data.still_path) item.still = imgUrl(data.still_path, "w300");
                if (data.overview) item.overview = data.overview;
              }
            } catch {}
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

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [tvShows, setTvShows] = useState<MediaItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [m, t, eps] = await Promise.all([
          fetchFilteredMedia("movie"),
          fetchFilteredMedia("tv"),
          fetchLatestEpisodesWithStills(),
        ]);
        setMovies(m);
        setTvShows(t);
        setEpisodes(eps);
      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load");
      } finally {
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

  const heroItems = movies.slice(0, 10);

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
          title="Series Terbaru"
          icon={<Tv className="h-5 w-5 text-purple-500" />}
          items={tvShows}
          onItemClick={handleDetail}
        />

        {episodes.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
              <Clock className="h-5 w-5 text-blue-500" />
              Episode Terbaru
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {episodes.map((e, i) => (
                <EpisodeCard
                  key={`${e.showTmdbId}-${e.season}-${e.episode}-${i}`}
                  episode={e}
                  onClick={() => handlePlayEpisode(e)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  );
}

// ============================================================
// SECTION (horizontal scroll, tanpa pagination)
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
// EPISODE CARD
// ============================================================
function EpisodeCard({ episode, onClick }: { episode: EpisodeItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-md bg-zinc-900 p-2 text-left transition hover:bg-zinc-800"
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
