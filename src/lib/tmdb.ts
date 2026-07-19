// ============================================================
// TMDB Client - Langsung dari browser (no Worker proxy needed)
// Pakai NEXT_PUBLIC_TMDB_API_KEY
// ============================================================

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

export interface MediaItem {
  id: string;              // IMDB ID jika ada, fallback ke tmdb-{tmdbId}
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

function poster(path?: string | null, size: "w185" | "w342" | "w500" = "w342"): string {
  if (!path) return "/placeholder-poster.png";
  return `${IMG_BASE}/${size}${path}`;
}

function backdrop(path?: string | null, size: "w780" | "w1280" | "original" = "w1280"): string {
  if (!path) return "/placeholder-backdrop.png";
  return `${IMG_BASE}/${size}${path}`;
}

function normalize(m: any, forceType?: "movie" | "tv"): MediaItem {
  const type: "movie" | "tv" = forceType || m.media_type || (m.first_air_date ? "tv" : "movie");
  return {
    id: m.imdb_id || `tmdb-${m.id}`,
    tmdbId: m.id,
    imdbId: m.imdb_id,
    title: m.title || m.name || m.original_title || m.original_name || "Untitled",
    type,
    poster: poster(m.poster_path),
    backdrop: backdrop(m.backdrop_path),
    overview: m.overview || "",
    year: (m.release_date || m.first_air_date || "").slice(0, 4),
    rating: m.vote_average || 0,
    genre: m.genre_ids?.length ? m.genre_ids.join(",") : undefined,
    genres: m.genre_ids,
  };
}

async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!TMDB_API_KEY) throw new Error("NEXT_PUBLIC_TMDB_API_KEY belum diset");
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`TMDB error ${r.status}`);
  return r.json();
}

// ============================================================
// Trending (campur movie + tv)
// ============================================================
export async function fetchTrending(window: "day" | "week" = "week", page = 1): Promise<MediaItem[]> {
  const data = await tmdbFetch(`/trending/all/${window}`, { page: String(page) });
  return (data.results || []).map((m: any) => normalize(m));
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

// ============================================================
// Detail (untuk dapat IMDB ID + seasons TV)
// ============================================================
export async function fetchDetail(tmdbId: number, type: "movie" | "tv"): Promise<MediaItem | null> {
  try {
    const data = await tmdbFetch(`/${type}/${tmdbId}`, {
      append_to_response: "external_ids",
    });
    const normalized = normalize(data, type);
    normalized.imdbId = data.external_ids?.imdb_id || data.imdb_id;
    if (normalized.imdbId) normalized.id = normalized.imdbId;
    // TV: attach seasons
    if (type === "tv" && data.seasons) {
      (normalized as any).seasons = data.seasons
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
        }));
    }
    return normalized;
  } catch (e) {
    console.error("[TMDB] detail failed:", e);
    return null;
  }
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

// ============================================================
// Genre list
// ============================================================
export async function fetchGenres(type: "movie" | "tv" = "movie"): Promise<Array<{ id: number; name: string }>> {
  const data = await tmdbFetch(`/genre/${type}/list`);
  return data.genres || [];
}

// ============================================================
// Helper: lazy fetch IMDB ID (untuk player)
// ============================================================
export async function fetchImdbId(tmdbId: number, type: "movie" | "tv"): Promise<string | null> {
  try {
    const data = await tmdbFetch(`/${type}/${tmdbId}/external_ids`);
    return data.imdb_id || null;
  } catch {
    return null;
  }
}
