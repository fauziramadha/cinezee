// ============================================================
// TMDB API Helper (client-side, via /api/tmdb proxy)
// ============================================================

export interface TMDBItem {
  id: string;            // "tt1375666" (IMDB ID)
  tmdbId: number;
  title: string;
  type: "movie" | "tv";
  poster: string;        // full URL
  backdrop: string;
  overview: string;
  year: string;
  rating: number;
  seasons?: Array<{
    seasonNumber: number;
    episodeCount: number;
    name: string;
  }>;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function posterUrl(path?: string): string {
  if (!path) return "/placeholder-poster.png";
  return `${TMDB_IMAGE_BASE}/w342${path}`;
}

function backdropUrl(path?: string): string {
  if (!path) return "/placeholder-backdrop.png";
  return `${TMDB_IMAGE_BASE}/w1280${path}`;
}

// ============================================================
// Trending (default beranda)
// ============================================================
export async function fetchTrending(
  window: "day" | "week" = "week",
  type: "movie" | "tv" | "all" = "all",
  page = 1,
): Promise<TMDBItem[]> {
  const url = `/api/tmdb/trending?window=${window}&type=${type}&page=${page}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB trending failed: ${r.status}`);
  const data = await r.json();
  return (data.results || []).map((m: any) => normalizeItem(m));
}

// ============================================================
// Popular
// ============================================================
export async function fetchPopular(
  type: "movie" | "tv" = "movie",
  page = 1,
): Promise<TMDBItem[]> {
  const url = `/api/tmdb/popular?type=${type}&page=${page}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB popular failed: ${r.status}`);
  const data = await r.json();
  return (data.results || []).map((m: any) => normalizeItem(m));
}

// ============================================================
// Search
// ============================================================
export async function searchTMDB(
  query: string,
  type: "movie" | "tv" = "movie",
): Promise<TMDBItem[]> {
  const url = `/api/tmdb/search?q=${encodeURIComponent(query)}&type=${type}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB search failed: ${r.status}`);
  const data = await r.json();
  return (data.results || []).map((m: any) => normalizeItem(m));
}

// ============================================================
// Detail (untuk dapat IMDB ID + seasons TV)
// ============================================================
export async function fetchDetail(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<TMDBItem | null> {
  const url = `/api/tmdb/detail?id=${tmdbId}&type=${type}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  return normalizeItem(data);
}

// ============================================================
// Normalize TMDB response ke format CineStream
// ============================================================
function normalizeItem(m: any): TMDBItem {
  const isTV = m.media_type === "tv" || m.first_air_date;
  const type: "movie" | "tv" = isTV ? "tv" : "movie";

  return {
    id: m.imdb_id || m.imdbId || `tmdb-${m.id}`,
    tmdbId: m.id,
    title: m.title || m.name || m.original_title || m.original_name || "Untitled",
    type,
    poster: posterUrl(m.poster_path),
    backdrop: backdropUrl(m.backdrop_path),
    overview: m.overview || "",
    year: (m.release_date || m.first_air_date || "").slice(0, 4),
    rating: m.vote_average || 0,
    seasons: m.seasons?.map((s: any) => ({
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      name: s.name || `Season ${s.season_number}`,
    })),
  };
}
