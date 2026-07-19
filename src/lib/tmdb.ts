// ============================================================
// TMDB Client - Langsung dari browser (no Worker proxy needed)
// Backward-compatible: mendukung nama function lama & baru
// ============================================================

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

// ============================================================
// Types
// ============================================================
export interface MediaItem {
  id: string;
  tmdbId: number;
  imdbId?: string;
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  overview: string;
  year: string;
  rating: number;
  genre?: string;
  genres?: number[];
}

// Alias untuk compatibility dengan kode lama
export type Movie = MediaItem;
export type TVShow = MediaItem;

export interface Genre {
  id: number;
  name: string;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
  name: string;
  overview?: string;
  airDate?: string;
  poster?: string;
}

export interface Episode {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string;
  still?: string;
  runtime?: number;
}

// ============================================================
// Image URL helpers
// ============================================================
export function getImageUrl(path?: string | null, size: string = "w342"): string {
  if (!path) return "/placeholder-poster.png";
  // Kalau path sudah full URL, return as-is
  if (path.startsWith("http")) return path;
  return `${IMG_BASE}/${size}${path}`;
}

export function getPosterUrl(path?: string | null, size: "w185" | "w342" | "w500" | "original" = "w342"): string {
  return getImageUrl(path, size);
}

export function getBackdropUrl(path?: string | null, size: "w780" | "w1280" | "original" = "w1280"): string {
  if (!path) return "/placeholder-backdrop.png";
  if (path.startsWith("http")) return path;
  return `${IMG_BASE}/${size}${path}`;
}

export function getProfileUrl(path?: string | null, size: "w185" | "h632" | "original" = "w185"): string {
  if (!path) return "/placeholder-person.png";
  if (path.startsWith("http")) return path;
  return `${IMG_BASE}/${size}${path}`;
}

export function getStillUrl(path?: string | null, size: "w300" | "w780" | "original" = "w300"): string {
  if (!path) return "/placeholder-backdrop.png";
  if (path.startsWith("http")) return path;
  return `${IMG_BASE}/${size}${path}`;
}

// ============================================================
// Internal fetch helper
// ============================================================
async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!TMDB_API_KEY) throw new Error("NEXT_PUBLIC_TMDB_API_KEY belum diset");
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`TMDB error ${r.status}: ${path}`);
  return r.json();
}

function normalize(m: any, forceType?: "movie" | "tv"): MediaItem {
  const type: "movie" | "tv" = forceType || m.media_type || (m.first_air_date ? "tv" : "movie");
  return {
    id: m.imdb_id || `tmdb-${m.id}`,
    tmdbId: m.id,
    imdbId: m.imdb_id,
    title: m.title || m.name || m.original_title || m.original_name || "Untitled",
    type,
    poster: getPosterUrl(m.poster_path),
    backdrop: getBackdropUrl(m.backdrop_path),
    overview: m.overview || "",
    year: (m.release_date || m.first_air_date || "").slice(0, 4),
    rating: m.vote_average || 0,
    genre: m.genre_ids?.length ? m.genre_ids.join(",") : undefined,
    genres: m.genre_ids,
  };
}

// ============================================================
// Trending
// ============================================================
export async function fetchTrending(window: "day" | "week" = "week", page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/trending/all/${window}`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m));
}

export async function fetchTrendingMovies(window: "day" | "week" = "week", page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/trending/movie/${window}`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

export async function fetchTrendingTV(window: "day" | "week" = "week", page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/trending/tv/${window}`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

// ============================================================
// Movies
// ============================================================
export async function fetchNowPlaying(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/movie/now_playing`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

export async function fetchPopularMovies(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/movie/popular`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

export async function fetchTopRatedMovies(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/movie/top_rated`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

export async function fetchUpcomingMovies(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/movie/upcoming`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

// ============================================================
// TV Shows
// ============================================================
export async function fetchPopularTV(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/tv/popular`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

export async function fetchTopRatedTV(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/tv/top_rated`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

export async function fetchAiringTodayTV(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/tv/airing_today`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

export async function fetchOnTheAirTV(page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/tv/on_the_air`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

// ============================================================
// Discover by Genre
// ============================================================
export async function fetchByGenre(
  genreId: number,
  type: "movie" | "tv" = "movie",
  page = 1,
): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/discover/${type}`, {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    page: String(page),
    "vote_count.gte": "100",
  });
  return (data.results || []).map((m: any) => normalize(m, type));
}

export async function fetchDiscover(
  type: "movie" | "tv",
  options: {
    genre?: number;
    year?: number;
    sortBy?: string;
    page?: number;
  } = {},
): Promise<MediaItem[]> {
  const params: Record<string, string> = {
    sort_by: options.sortBy || "popularity.desc",
    page: String(options.page || 1),
    "vote_count.gte": "50",
    include_adult: "false",
  };
  if (options.genre) params.with_genres = String(options.genre);
  if (options.year) {
    if (type === "movie") params.primary_release_year = String(options.year);
    else params.first_air_date_year = String(options.year);
  }
  const data = await tmdbFetch(`/discover/${type}`, params);
  return (data.results || []).map((m: any) => normalize(m, type));
}

// ============================================================
// Detail (movie / tv / person)
// ============================================================
export async function fetchDetail(tmdbId: number, type: "movie" | "tv"): Promise<MediaItem | null> {
  try {
    const data = await tmdbFetch(`/${type}/${tmdbId}`, {
      append_to_response: "external_ids,credits,videos,similar,recommendations,images",
    });
    const normalized = normalize(data, type);
    normalized.imdbId = data.external_ids?.imdb_id || data.imdb_id;
    if (normalized.imdbId) normalized.id = normalized.imdbId;
    if (type === "tv" && data.seasons) {
      (normalized as any).seasons = data.seasons
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
          overview: s.overview,
          airDate: s.air_date,
          poster: getPosterUrl(s.poster_path),
        }));
    }
    return normalized;
  } catch (e) {
    console.error("[TMDB] detail failed:", e);
    return null;
  }
}

export async function fetchMovieDetail(tmdbId: number): Promise<any> {
  const data = await tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: "external_ids,credits,videos,similar,recommendations,images,release_dates",
  });
  return data;
}

export async function fetchTVDetail(tmdbId: number): Promise<any> {
  const data = await tmdbFetch(`/tv/${tmdbId}`, {
    append_to_response: "external_ids,credits,videos,similar,recommendations,images,content_ratings",
  });
  return data;
}

export async function fetchPersonDetail(personId: number): Promise<any> {
  const data = await tmdbFetch(`/person/${personId}`, {
    append_to_response: "movie_credits,tv_credits,images,external_ids",
  });
  return data;
}

// ============================================================
// Season & Episode
// ============================================================
export async function fetchSeason(tvId: number, seasonNumber: number): Promise<any> {
  const data = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`);
  return data;
}

export async function fetchEpisode(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<any> {
  const data = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
  return data;
}

// ============================================================
// Search
// ============================================================
export async function searchMulti(query: string, page = 1): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch(`/search/multi`, {
    query,
    page: String(page),
    include_adult: "false",
  });
  return (data.results || [])
    .filter((m: any) => m.media_type === "movie" || m.media_type === "tv")
    .map((m: any) => normalize(m));
}

export async function searchMovies(query: string, page = 1): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch(`/search/movie`, {
    query,
    page: String(page),
    include_adult: "false",
  });
  return (data.results || []).map((m: any) => normalize(m, "movie"));
}

export async function searchTV(query: string, page = 1): Promise<MediaItem[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch(`/search/tv`, {
    query,
    page: String(page),
    include_adult: "false",
  });
  return (data.results || []).map((m: any) => normalize(m, "tv"));
}

export async function searchPeople(query: string, page = 1): Promise<any[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch(`/search/person`, {
    query,
    page: String(page),
    include_adult: "false",
  });
  return (data.results || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    profile: getProfileUrl(p.profile_path),
    knownFor: p.known_for_department || "",
  }));
}

// ============================================================
// Genres & Networks
// ============================================================
export async function fetchGenres(type: "movie" | "tv" = "movie"): Promise<Genre[]> {
  const data = await tmdbFetch(`/genre/${type}/list`);
  return data.genres || [];
}

export async function fetchNetworks(): Promise<any[]> {
  // TMDB tidak punya endpoint list networks, pakai hardcode popular
  return [
    { id: 213, name: "Netflix" },
    { id: 1024, name: "Amazon Prime" },
    { id: 2739, name: "Disney+" },
    { id: 453, name: "Hulu" },
    { id: 49, name: "HBO" },
    { id: 4330, name: "Apple TV+" },
    { id: 60, name: " Paramount+" },
    { id: 25, name: "ABC" },
    { id: 2, name: "BBC" },
  ];
}

// ============================================================
// External IDs helper
// ============================================================
export async function fetchImdbId(tmdbId: number, type: "movie" | "tv"): Promise<string | null> {
  try {
    const data = await tmdbFetch(`/${type}/${tmdbId}/external_ids`);
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

export async function fetchExternalIds(tmdbId: number, type: "movie" | "tv"): Promise<any> {
  const data = await tmdbFetch(`/${type}/${tmdbId}/external_ids`);
  return data;
}

// ============================================================
// Recommendations & Similar
// ============================================================
export async function fetchRecommendations(
  tmdbId: number,
  type: "movie" | "tv",
  page = 1,
): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/${type}/${tmdbId}/recommendations`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, type));
}

export async function fetchSimilar(
  tmdbId: number,
  type: "movie" | "tv",
  page = 1,
): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/${type}/${tmdbId}/similar`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m, type));
}

export async function fetchCredits(tmdbId: number, type: "movie" | "tv"): Promise<any> {
  const data = await tmdbFetch(`/${type}/${tmdbId}/credits`);
  return data;
}

export async function fetchVideos(tmdbId: number, type: "movie" | "tv"): Promise<any[]> {
  const data = await tmdbFetch(`/${type}/${tmdbId}/videos`);
  return data.results || [];
}

// ============================================================
// =============================================================
// BACKWARD-COMPATIBLE ALIASES (untuk file lama)
// Semua function dengan prefix "get" di-mapping ke "fetch"
// =============================================================
// =============================================================

export const getTrending = fetchTrending;
export const getTrendingMovies = fetchTrendingMovies;
export const getTrendingTV = fetchTrendingTV;

export const getNowPlaying = fetchNowPlaying;
export const getPopularMovies = fetchPopularMovies;
export const getTopRatedMovies = fetchTopRatedMovies;
export const getUpcomingMovies = fetchUpcomingMovies;

export const getPopularTV = fetchPopularTV;
export const getTopRatedTV = fetchTopRatedTV;
export const getAiringTodayTV = fetchAiringTodayTV;
export const getOnTheAirTV = fetchOnTheAirTV;

// Alias umum: getMovies / getTVShows
export const getMovies = fetchPopularMovies;
export const getTVShows = fetchPopularTV;
export const getPopular = fetchPopularMovies;

export const getTopRated = fetchTopRatedMovies;
export const getUpcoming = fetchUpcomingMovies;
export const getNowPlayingMovies = fetchNowPlaying;

export const getByGenre = fetchByGenre;
export const getDiscover = fetchDiscover;

export const getDetail = fetchDetail;
export const getMovieDetail = fetchMovieDetail;
export const getTVDetail = fetchTVDetail;
export const getTVShowDetail = fetchTVDetail;
export const getPersonDetail = fetchPersonDetail;
export const getPerson = fetchPersonDetail;

export const getSeason = fetchSeason;
export const getSeasonDetail = fetchSeason;
export const getEpisode = fetchEpisode;
export const getEpisodeDetail = fetchEpisode;

export const search = searchMulti;
export const getSearch = searchMulti;
export const getSearchMovies = searchMovies;
export const getSearchTV = searchTV;
export const getSearchPeople = searchPeople;

export const getGenres = fetchGenres;
export const getGenreList = fetchGenres;
export const getNetworks = fetchNetworks;

export const getImdbId = fetchImdbId;
export const getExternalIds = fetchExternalIds;

export const getRecommendations = fetchRecommendations;
export const getSimilar = fetchSimilar;
export const getCredits = fetchCredits;
export const getVideos = fetchVideos;

// Image helpers alias
export const getImagePath = getImageUrl;
export const getStill = getStillUrl;
export const getProfile = getProfileUrl;

// Default export untuk memudahkan import
export default {
  fetchTrending,
  fetchPopularMovies,
  fetchPopularTV,
  fetchTopRatedMovies,
  fetchTopRatedTV,
  fetchNowPlaying,
  fetchUpcomingMovies,
  fetchByGenre,
  fetchDetail,
  fetchMovieDetail,
  fetchTVDetail,
  fetchPersonDetail,
  fetchSeason,
  fetchEpisode,
  searchMulti,
  searchMovies,
  searchTV,
  fetchGenres,
  fetchImdbId,
  fetchRecommendations,
  fetchSimilar,
  getImageUrl,
  getPosterUrl,
  getBackdropUrl,
  getProfileUrl,
};
