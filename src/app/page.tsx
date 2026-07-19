"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Star, TrendingUp, Film, Tv, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  fetchLatestMovies,
  fetchLatestTVShows,
  fetchLatestEpisodes,
  VidapiMovie,
  VidapiTVShow,
  VidapiEpisode,
  getTMDBImage,
} from "@/lib/vidapi-client";

function movieToPlayerMedia(m: VidapiMovie) {
  return {
    id: m.imdb_id || m.tmdb_id,
    imdbId: m.imdb_id || undefined,
    tmdbId: m.tmdb_id,
    title: m.title,
    type: "movie" as const,
    poster: getTMDBImage(m.poster_url, "w342"),
    backdrop: getTMDBImage(m.poster_url, "w1280"),
    overview: "",
    year: m.year,
    rating: parseFloat(m.rating) || 0,
  };
}

function tvToPlayerMedia(t: VidapiTVShow) {
  return {
    id: t.imdb_id || t.tmdb_id,
    imdbId: t.imdb_id || undefined,
    tmdbId: t.tmdb_id,
    title: t.title,
    type: "tv" as const,
    poster: getTMDBImage(t.poster_url, "w342"),
    backdrop: getTMDBImage(t.poster_url, "w1280"),
    overview: "",
    year: t.year,
    rating: parseFloat(t.rating) || 0,
    seasons: [{ seasonNumber: 1, episodeCount: 1, name: "Season 1" }],
  };
}

function episodeToPlayerMedia(e: VidapiEpisode) {
  return {
    id: e.show_imdb_id || e.show_tmdb_id,
    imdbId: e.show_imdb_id || undefined,
    tmdbId: e.show_tmdb_id,
    title: `${e.show_title} - S${e.season_number}E${e.episode_number}`,
    type: "tv" as const,
    poster: "",
    backdrop: "",
    overview: e.episode_title,
    year: (e.air_date || "").slice(0, 4),
    rating: 0,
    seasons: [{
      seasonNumber: parseInt(e.season_number) || 1,
      episodeCount: parseInt(e.episode_number) || 1,
      name: `Season ${e.season_number}`,
    }],
  };
}

export default function HomePage() {
  const { setPlayerMedia } = useAppStore();

  const [movies, setMovies] = useState<VidapiMovie[]>([]);
  const [tvShows, setTvShows] = useState<VidapiTVShow[]>([]);
  const [episodes, setEpisodes] = useState<VidapiEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [movRes, tvRes, epRes] = await Promise.all([
          fetchLatestMovies(1),
          fetchLatestTVShows(1),
          fetchLatestEpisodes(1),
        ]);
        setMovies(movRes.items);
        setTvShows(tvRes.items);
        setEpisodes(epRes.items.slice(0, 24));
      } catch (err: any) {
        console.error("[Home] Load error:", err);
        setError(err?.message || "Failed to load content");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadMoreMovies = useCallback(async (page: number) => {
    try {
      const data = await fetchLatestMovies(page);
      setMovies(data.items);
      setMoviePage(page);
    } catch (e) {}
  }, []);

  const loadMoreTV = useCallback(async (page: number) => {
    try {
      const data = await fetchLatestTVShows(page);
      setTvShows(data.items);
      setTvPage(page);
    } catch (e) {}
  }, []);

  const handlePlayMovie = (m: VidapiMovie) => setPlayerMedia(movieToPlayerMedia(m));
  const handlePlayTV = (t: VidapiTVShow) => setPlayerMedia(tvToPlayerMedia(t));
  const handlePlayEpisode = (e: VidapiEpisode) => setPlayerMedia(episodeToPlayerMedia(e));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/70">Memuat konten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center">
        <p className="text-red-400">Gagal memuat konten</p>
        <p className="text-xs text-white/50">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {movies[0] && <HeroSection movie={movies[0]} onPlay={handlePlayMovie} />}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Section
          title="Film Terbaru"
          icon={<Film className="h-5 w-5" />}
          items={movies}
          page={moviePage}
          onPageChange={loadMoreMovies}
          renderItem={(m) => <MovieCard movie={m} onClick={() => handlePlayMovie(m)} />}
        />

        <Section
          title="Series Terbaru"
          icon={<Tv className="h-5 w-5" />}
          items={tvShows}
          page={tvPage}
          onPageChange={loadMoreTV}
          renderItem={(t) => <TVCard show={t} onClick={() => handlePlayTV(t)} />}
        />

        {episodes.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white sm:text-xl">
              <Clock className="h-5 w-5" />
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
    </div>
  );
}

function HeroSection({ movie, onPlay }: { movie: VidapiMovie; onPlay: (m: VidapiMovie) => void }) {
  const backdrop = getTMDBImage(movie.poster_url, "w1280");
  return (
    <div className="relative h-[50vh] min-h-[360px] w-full overflow-hidden sm:h-[60vh]">
      <img
        src={backdrop}
        alt={movie.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14">
        <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
          <TrendingUp className="h-3 w-3" /> Baru Ditambahkan
        </span>
        <h1 className="max-w-2xl text-2xl font-bold text-white sm:text-4xl md:text-5xl">
          {movie.title}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-white/80">
          {parseFloat(movie.rating) > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              {movie.rating}
            </span>
          )}
          <span>•</span>
          <span>{movie.year}</span>
          {movie.genre && (
            <>
              <span>•</span>
              <span className="line-clamp-1">{movie.genre}</span>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => onPlay(movie)}
            className="flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Play className="h-4 w-4 fill-black" />
            Putar
          </button>
        </div>
      </div>
    </div>
  );
}

function Section<T>({
  title,
  icon,
  items,
  page,
  onPageChange,
  renderItem,
}: {
  title: string;
  icon?: React.ReactNode;
  items: T[];
  page: number;
  onPageChange: (page: number) => void;
  onPlay?: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white sm:text-xl">
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
      <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, idx) => (
          <div key={idx} className="shrink-0">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

function MovieCard({ movie, onClick }: { movie: VidapiMovie; onClick: () => void }) {
  const poster = getTMDBImage(movie.poster_url, "w342");
  return (
    <button onClick={onClick} className="group relative block w-32 text-left sm:w-40 md:w-44">
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-900">
        <img
          src={poster}
          alt={movie.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
        <Play className="h-8 w-8 fill-white text-white" />
      </div>
      <div className="mt-2">
        <p className="line-clamp-1 text-xs font-medium text-white sm:text-sm">{movie.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/50">
          <span>{movie.year}</span>
          {parseFloat(movie.rating) > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                {movie.rating}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function TVCard({ show, onClick }: { show: VidapiTVShow; onClick: () => void }) {
  const poster = getTMDBImage(show.poster_url, "w342");
  return (
    <button onClick={onClick} className="group relative block w-32 text-left sm:w-40 md:w-44">
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-900">
        <img
          src={poster}
          alt={show.title}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
        <Play className="h-8 w-8 fill-white text-white" />
      </div>
      <div className="mt-2">
        <p className="line-clamp-1 text-xs font-medium text-white sm:text-sm">{show.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/50">
          <span>{show.year}</span>
          {parseFloat(show.rating) > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                {show.rating}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

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
