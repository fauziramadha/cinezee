// ============================================================
// CineStream VPS API Client
// Menggantikan VidAPI dengan VPS API (api.cinestream.my.id)
// ============================================================

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

// ============================================================
// Types
// ============================================================

export interface CinemacityContent {
  id: number;
  cinemacity_id: string;
  slug: string;
  title: string;
  type: string; // "movie" | "tv"
  poster_url: string | null;
  description: string | null;
  rating: number | null;
  release_year: number | null;
  quality: string | null;
}

export interface EnrichedMediaItem {
  id: string; // cinemacity_id (for player lookup)
  cinemacityId: string; // explicit cinemacity_id
  slug: string; // for stream URL
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
  seasons?: Array<{
    seasonNumber: number;
    episodeCount: number;
    name?: string;
  }>;
}

// ============================================================
// VPS API Fetch Helper
// ============================================================
async function fetchVPS<T>(path: string): Promise<T> {
  const url = `${VPS_API_BASE}${path}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 }, // Cache 1 jam di Next.js level
  });
  if (!r.ok) throw new Error(`VPS API error: ${r.status}`);
  return r.json();
}

// ============================================================
// TMDB Search by Title (karena cinemacity tidak punya tmdb_id)
// ============================================================
async function searchTMDB(
  title: string,
  type: "movie" | "tv",
  year?: number
): Promise<any | null> {
  if (!TMDB_KEY || !title) return null;
  try {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: title,
      language: "en-US",
      page: "1",
      include_adult: "false",
    });
    if (year) params.set("year", String(year));

    const res = await fetch(
      `https://api.themoviedb.org/3/search/${type}?${params}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch (e) {
    console.warn(`[TMDB search] failed for "${title}":`, e);
    return null;
  }
}

// ============================================================
// TMDB Detail (untuk imdb_id + seasons)
// ============================================================
async function getTMDBDetail(
  tmdbId: number,
  type: "movie" | "tv"
): Promise<any | null> {
  if (!TMDB_KEY || !tmdbId) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US&append_to_response=external_ids`
    );
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

// ============================================================
// Enrich single cinemacity item with TMDB metadata
// ============================================================
async function enrichItem(
  item: CinemacityContent
): Promise<EnrichedMediaItem> {
  const type: "movie" | "tv" = item.type === "tv" ? "tv" : "movie";

  // Basic data dari VPS API
  const enriched: EnrichedMediaItem = {
    id: item.cinemacity_id,
    cinemacityId: item.cinemacity_id,
    slug: item.slug,
    tmdbId: 0,
    title: item.title,
    type,
    poster: item.poster_url || "/placeholder-poster.png",
    backdrop: item.poster_url || "/placeholder-poster.png",
    overview: item.description || "",
    year: item.release_year ? String(item.release_year) : "",
    rating: item.rating || 0,
  };

  // Search TMDB by title (+ year untuk accuracy)
  const tmdbResult = await searchTMDB(
    item.title,
    type,
    item.release_year || undefined
  );

  if (tmdbResult) {
    enriched.tmdbId = tmdbResult.id;
    if (tmdbResult.overview) enriched.overview = tmdbResult.overview;
    if (tmdbResult.backdrop_path)
      enriched.backdrop = `${TMDB_IMG}/w1280${tmdbResult.backdrop_path}`;
    if (tmdbResult.poster_path)
      enriched.poster = `${TMDB_IMG}/w342${tmdbResult.poster_path}`;
    if (tmdbResult.vote_average)
      enriched.rating = tmdbResult.vote_average;
    if (tmdbResult.release_date || tmdbResult.first_air_date) {
      const dateStr = tmdbResult.release_date || tmdbResult.first_air_date;
      enriched.year = dateStr.substring(0, 4);
    }

    // Get detail untuk imdb_id + seasons (TV)
    const detail = await getTMDBDetail(tmdbResult.id, type);
    if (detail) {
      if (detail.imdb_id) enriched.imdbId = detail.imdb_id;
      if (detail.genres?.length) {
        enriched.genre = detail.genres
          .map((g: any) => g.name)
          .join(", ");
      }
      if (type === "tv" && detail.seasons) {
        enriched.seasons = detail.seasons
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            name: s.name,
          }));
      }
    }
  }

  return enriched;
}

// ============================================================
// Batch enrich dengan rate limiting (max 5 concurrent)
// ============================================================
async function enrichBatch(
  items: CinemacityContent[]
): Promise<EnrichedMediaItem[]> {
  const batchSize = 5;
  const results: EnrichedMediaItem[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const enriched = await Promise.all(batch.map(enrichItem));
    results.push(...enriched);
  }

  return results;
}

// ============================================================
// Fetch Latest Movies (from VPS API, filter type=movie)
// ============================================================
export async function fetchLatestMovies(
  page = 1
): Promise<EnrichedMediaItem[]> {
  const data = await fetchVPS<{ items: CinemacityContent[] }>(
    `/api/home/page/${page}`
  );
  const movies = (data.items || []).filter((item) => item.type === "movie");
  return enrichBatch(movies);
}

// ============================================================
// Fetch Latest TV Shows (from VPS API, filter type=tv)
// ============================================================
export async function fetchLatestTVShows(
  page = 1
): Promise<EnrichedMediaItem[]> {
  const data = await fetchVPS<{ items: CinemacityContent[] }>(
    `/api/home/page/${page}`
  );
  const tvShows = (data.items || []).filter((item) => item.type === "tv");
  return enrichBatch(tvShows);
}

// ============================================================
// Fetch Latest Episodes
// VPS API tidak punya endpoint khusus episodes,
// return TV shows terbaru sebagai替代
// ============================================================
export async function fetchLatestEpisodes(
  page = 1
): Promise<EnrichedMediaItem[]> {
  // Return TV shows sebagai "latest episodes" (yang baru update)
  return fetchLatestTVShows(page);
}

// ============================================================
// Fetch Home Data (hero carousel + sections)
// ============================================================
export interface HomeData {
  generated_at: string;
  hero_carousel: CinemacityContent[];
  sections: Array<{
    id: string;
    title: string;
    type: string;
    items: CinemacityContent[];
  }>;
}

export async function fetchHomeData(): Promise<HomeData> {
  return fetchVPS<HomeData>(`/api/home`);
}

// ============================================================
// enrichWithTMDB - keep for compatibility
// ============================================================
export async function enrichWithTMDB(
  items: CinemacityContent[],
  _type: "movie" | "tv"
): Promise<EnrichedMediaItem[]> {
  return enrichBatch(items);
}

// ============================================================
// Image URL helper
// ============================================================
export function getTMDBImage(
  url: string,
  size: "w185" | "w342" | "w500" | "w1280" | "original" = "w342"
): string {
  if (!url) return "/placeholder-poster.png";
  // Handle TMDB URLs
  if (url.includes("image.tmdb.org")) {
    return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`);
  }
  // Handle cinemacity URLs (return as-is)
  return url;
}

// ============================================================
// Search (via VPS API)
// ============================================================
export async function searchContent(
  query: string
): Promise<EnrichedMediaItem[]> {
  if (!query || query.length < 2) return [];
  const data = await fetchVPS<{
    data: { results: CinemacityContent[]; total: number };
  }>(`/api/search?q=${encodeURIComponent(query)}`);
  const results = data.data?.results || [];
  return enrichBatch(results);
}

// ============================================================
// Get Content Detail (via VPS API)
// ============================================================
export async function getContentDetail(
  cinemacityId: string
): Promise<CinemacityContent | null> {
  const data = await fetchVPS<{ data: CinemacityContent }>(
    `/api/content/${cinemacityId}`
  );
  return data.data || null;
}
