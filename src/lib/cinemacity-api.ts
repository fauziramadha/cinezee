/**
 * src/lib/cinemacity-api.ts
 *
 * Client-side API helper untuk cinemacity endpoints.
 * Convert cinemacity data → TMDB Movie shape supaya compatible dengan
 * komponen yang sudah ada (MovieCard, ContentRow, dll).
 */

import type { Movie, MovieDetail } from "@/lib/tmdb";
import type {
  CinemacityMovie,
  CinemacityDetail,
  CinemacitySubtitle,
} from "@/lib/cinemacity-parser";

// =====================================================
// ADAPTER: CinemacityMovie → TMDB Movie
// =====================================================
export function cinemacityToTMDB(cm: CinemacityMovie): Movie {
  return {
    id: Number(cm.id),
    title: cm.title,
    name: cm.type === "tv" ? cm.title : undefined,
    overview: "",
    poster_path: cm.poster || null,
    backdrop_path: cm.poster || null,
    vote_average: 0,
    vote_count: 0,
    release_date: cm.year ? `${cm.year}-01-01` : undefined,
    first_air_date: cm.year ? `${cm.year}-01-01` : undefined,
    media_type: cm.type,
    popularity: 0,
    ...({ slug: cm.slug, source: "cinemacity" } as any),
  };
}

// =====================================================
// ADAPTER: CinemacityDetail → TMDB MovieDetail
// =====================================================
export function cinemacityDetailToTMDB(cd: CinemacityDetail): MovieDetail {
  return {
    id: Number(cd.id),
    title: cd.title,
    name: cd.type === "tv" ? cd.title : undefined,
    overview: cd.description || "",
    poster_path: cd.poster || null,
    backdrop_path: cd.backdrop || cd.poster || null,
    vote_average: 0,
    vote_count: 0,
    release_date: cd.year ? `${cd.year}-01-01` : undefined,
    first_air_date: cd.year ? `${cd.year}-01-01` : undefined,
    media_type: cd.type,
    genres: (cd.genres || []).map((g, i) => ({ id: i, name: g })),
    runtime: undefined,
    status: "Released",
    tagline: "",
    credits: { cast: [], crew: [] },
    videos: { results: [] },
    similar: { results: [] },
    recommendations: { results: [] },
    ...({
      slug: cd.slug,
      source: "cinemacity",
      streamUrl: cd.streamUrl,
      qualities: cd.qualities,
      subtitles: cd.subtitles,
      episodes: cd.episodes,
    } as any),
  };
}

// =====================================================
// FETCH FUNCTIONS
// =====================================================

export function getMovieSlug(movie: Movie | any): string {
  if (movie.slug) return movie.slug;
  if (movie.id) return `${movie.id}-x`;
  return "";
}

export function isCinemacitySource(movie: Movie | any): boolean {
  return movie?.source === "cinemacity" || !!movie?.slug;
}

export async function fetchCinemacityHome(type: "all" | "movies" | "tv" = "all"): Promise<Movie[]> {
  const res = await fetch(`/api/cinemacity/home?type=${type}`);
  if (!res.ok) throw new Error("Failed to fetch cinemacity home");
  const data = await res.json();
  return (data.movies || []).map(cinemacityToTMDB);
}

export async function fetchCinemacitySearch(query: string, type: "all" | "movies" | "tv" = "all"): Promise<Movie[]> {
  const res = await fetch(`/api/cinemacity/search?q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error("Failed to search cinemacity");
  const data = await res.json();
  return (data.movies || []).map(cinemacityToTMDB);
}

export async function fetchCinemacityGenre(genre: string, page = 1): Promise<Movie[]> {
  const res = await fetch(`/api/cinemacity/genre/${genre}?page=${page}`);
  if (!res.ok) throw new Error("Failed to fetch genre");
  const data = await res.json();
  return (data.movies || []).map(cinemacityToTMDB);
}

export async function fetchCinemacityDetail(slug: string): Promise<{
  detail: MovieDetail;
  streamUrl?: string;
  qualities?: string[];
  subtitles?: CinemacitySubtitle[];
  episodes?: any[];
}> {
  const res = await fetch(`/api/cinemacity/movie/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch detail");
  const data = await res.json();
  const cd: CinemacityDetail = data.movie;
  return {
    detail: cinemacityDetailToTMDB(cd),
    streamUrl: cd.streamUrl,
    qualities: cd.qualities,
    subtitles: cd.subtitles,
    episodes: cd.episodes,
  };
}

export async function fetchCinemacityPlay(slug: string): Promise<{
  streamUrl: string;
  qualities: string[];
  subtitles: CinemacitySubtitle[];
  poster?: string;
  title: string;
  type: string;
}> {
  const res = await fetch(`/api/cinemacity/play/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch play URL");
  return res.json();
}

export function getStreamProxyUrl(streamUrl: string): string {
  return `/api/cinemacity/stream?url=${encodeURIComponent(streamUrl)}`;
}

export async function fetchCinemacityGenres(): Promise<
  { slug: string; name: string; url: string }[]
> {
  const res = await fetch("/api/cinemacity/genres");
  if (!res.ok) return [];
  const data = await res.json();
  return data.genres || [];
}
