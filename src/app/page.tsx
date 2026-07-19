"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Star, TrendingUp, Film, Tv, Clock,
  ChevronLeft, ChevronRight, Flame, Award, Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  fetchLatestMovies,
  fetchLatestTVShows,
  fetchLatestEpisodes,
  enrichWithTMDB,
  getTMDBImage,
  VidapiMovie,
  VidapiTVShow,
  VidapiEpisode,
  EnrichedMediaItem,
} from "@/lib/vidapi-client";
import { Header } from "@/components/cinepro/header";
import { Footer } from "@/components/cinepro/footer";

export default function HomePage() {
  const { setPlayerMedia, setDetailMedia } = useAppStore();

  const [movies, setMovies] = useState<EnrichedMediaItem[]>([]);
  const [tvShows, setTvShows] = useState<EnrichedMediaItem[]>([]);
  const [episodes, setEpisodes] = useState<VidapiEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // === Fetch VidAPI (primary source) ===
        const [rawMovies, rawTV, eps] = await Promise.all([
          fetchLatestMovies(1, 1.0),
          fetchLatestTVShows(1, 1.0),
          fetchLatestEpisodes(1),
        ]);

        // === Enrich dengan TMDB (sinopsis, backdrop, genre) - paralel ===
        const [enrichedMovies, enrichedTV] = await Promise.all([
          enrichWithTMDB(rawMovies.slice(0, 24), "movie"),
          enrichWithTMDB(rawTV.slice(0, 24), "tv"),
        ]);

        setMovies(enrichedMovies);
        setTvShows(enrichedTV);
        setEpisodes(eps.slice(0, 24));
      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadMoreMovies = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const raw = await fetchLatestMovies(page, 1.0);
      const enriched = await enrichWithTMDB(raw.slice(0, 24), "movie");
      setMovies(enriched);
      setMoviePage(page);
    } catch (e) {} finally { setLoading(false); }
  }, []);

  const loadMoreTV = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const raw = await fetchLatestTVShows(page, 1.0);
      const enriched = await enrichWithTMDB(raw.slice(0, 24), "tv");
      setTvShows(enriched);
      setTvPage(page);
    } catch (e) {} finally { setLoading(false); }
  }, []);

  const handlePosterClick = useCallback((item: EnrichedMediaItem) => {
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

  const handlePlay = useCallback((item: EnrichedMediaItem) => {
    setPlayerMedia({
      id: item.imdbId || item.id,
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

  const handlePlayEpisode = useCallback((ep: VidapiEpisode) => {
    setPlayerMedia({
      id: ep.show_imdb_id || ep.show_tmdb_id,
      imdbId: ep.show_imdb_id || undefined,
      tmdbId: parseInt(ep.show_tmdb_id, 10) || 0,
      title: `${ep.show_title} - S${ep.season_number}E${ep.episode_number}`,
      type: "tv",
      title_original: ep.show_title,
      poster: "",
      backdrop: "",
      overview: ep.episode_title,
      year: (ep.air_date || "").slice(0, 4),
      rating: 0,
      seasons: [{
        seasonNumber: parseInt(ep.season_number) || 1,
        episodeCount: parseInt(ep.episode_number) || 1,
        name: `Season ${ep.season_number}`,
      }],
      _currentSeason: ep.season_number,
      _currentEpisode: ep.episode_number,
    } as any);
  }, [setPlayerMedia]);

  if (loading && movies.length === 0) {
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

  const hero = movies[0];

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {hero && <Hero item={hero} onPlay={handlePlay} onMoreInfo={handlePosterClick} />}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Section
          title="Film Terbaru"
          icon={<Film className="h-5 w-5 text-red-500" />}
          items={movies}
          page={moviePage}
          onPageChange={loadMoreMovies}
          onItemClick={handlePosterClick}
        />

        <Section
          title="Series Terbaru"
          icon={<Tv className="h-5 w-5 text-purple-500" />}
          items={tvShows}
          page={tvPage}
          onPageChange={loadMoreTV}
          onItemClick={handlePosterClick}
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
                  key={`${e.show_tmdb_id}-${e.season_number}-${e.episode_number}-${i}`}
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
// HERO
// ============================================================
function Hero({ item, onPlay, onMoreInfo }: {
  item: EnrichedMediaItem;
  onPlay: (i: EnrichedMediaItem) => void;
  onMoreInfo: (i: EnrichedMediaItem) => void;
}) {
  return (
    <div className="relative h-[70vh] min-h-[500px] w-full overflow-hidden">
      <img
        src={item.backdrop}
        alt={item.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14 lg:p-16">
        <div className="max-w-2xl">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <Flame className="h-3 w-3" /> Trending
          </span>
          <h1 className="text-3xl font-black leading-tight text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl">
            {item.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {item.rating > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-1 font-semibold text-yellow-400">
                <Star className="h-3.5 w-3.5 fill-yellow-400" />
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.year && <span className="text-white/80">{item.year}</span>}
            <span className="rounded border border-white/30 px-2 py-0.5 text-xs uppercase text-white/80">
              {item.type === "tv" ? "TV Series" : "Movie"}
            </span>
            {item.genre && <span className="text-white/60 text-xs">{item.genre}</span>}
          </div>
          {item.overview && (
            <p className="mt-4 max-w-xl text-sm text-white/80 line-clamp-3 sm:text-base md:text-lg">
              {item.overview}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => onPlay(item)}
              className="flex items-center gap-2 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition hover:bg-white/90 active:scale-95"
            >
              <Play className="h-5 w-5 fill-black" />
              Putar Sekarang
            </button>
            <button
              onClick={() => onMoreInfo(item)}
              className="flex items-center gap-2 rounded-md bg-white/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
            >
              Info Selengkapnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION (horizontal scroll + pagination)
// ============================================================
function Section<T>({ title, icon, items, page, onPageChange, onItemClick }: {
  title: string;
  icon?: React.ReactNode;
  items: T[];
  page: number;
  onPageChange: (page: number) => void;
  onItemClick: (item: T) => void;
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white/80 transition hover:bg-zinc-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/50">Hal {page}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white/80 transition hover:bg-zinc-800"
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
          <MediaCard key={`${(item as any).id}-${idx}`} item={item as any} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// MEDIA CARD
// ============================================================
function MediaCard({ item, onClick }: { item: EnrichedMediaItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative block w-[140px] shrink-0 text-left sm:w-[160px] md:w-[180px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5 transition group-hover:ring-2 group-hover:ring-white/30">
        <img
          src={item.poster}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
        />
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {item.rating > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-yellow-400" />
              {item.rating.toFixed(1)}
            </span>
          )}
          <span className="rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/80 backdrop-blur-sm">
            {item.type === "tv" ? "TV" : "Film"}
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 transition group-hover:scale-110">
              <Play className="h-6 w-6 fill-black text-black" />
            </div>
            <span className="rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase text-white">
              Lihat Detail
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-1 text-xs font-semibold text-white sm:text-sm">{item.title}</p>
        <p className="mt-0.5 text-[10px] text-white/50">
          {item.year || "—"}
          {item.rating > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              • <Star className="h-2 w-2 fill-yellow-500 text-yellow-500" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

// ============================================================
// EPISODE CARD
// ============================================================
function EpisodeCard({ episode, onClick }: { episode: VidapiEpisode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-md bg-zinc-900 p-2 text-left transition hover:bg-zinc-800"
    >
      <div className="relative aspect-video overflow-hidden rounded bg-zinc-800">
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="h-8 w-8 fill-white/80 text-white/80 transition group-hover:scale-110" />
        </div>
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
          S{episode.season_number}E{episode.episode_number}
        </span>
      </div>
      <div>
        <p className="line-clamp-1 text-xs font-medium text-white">{episode.show_title}</p>
        <p className="line-clamp-1 text-[10px] text-white/50">{episode.episode_title}</p>
        <p className="mt-0.5 text-[10px] text-white/40">{episode.air_date}</p>
      </div>
    </button>
  );
}
