// ============================================================
// CineStream VPS API Client
// 100% pakai VPS API (api.cinestream.my.id) - NO TMDB
// ============================================================

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

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
  title: string;
  type: "movie" | "tv";
  poster: string;
  backdrop: string;
  overview: string;
  year: string;
  rating: number;
  quality?: string;
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
// Format cinemacity item to EnrichedMediaItem (NO TMDB)
// ============================================================
function formatItem(item: CinemacityContent): EnrichedMediaItem {
  const type: "movie" | "tv" = item.type === "tv" ? "tv" : "movie";
  return {
    id: item.cinemacity_id,
    cinemacityId: item.cinemacity_id,
    slug: item.slug,
    title: item.title,
    type,
    poster: item.poster_url || "/placeholder-poster.png",
    backdrop: item.poster_url || "/placeholder-poster.png",
    overview: item.description || "",
    year: item.release_year ? String(item.release_year) : "",
    rating: item.rating || 0,
    quality: item.quality || undefined,
  };
}

// ============================================================
// Batch format (NO enrichment needed, VPS has all data)
// ============================================================
function formatBatch(items: CinemacityContent[]): EnrichedMediaItem[] {
  return items.map(formatItem);
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
  return formatBatch(movies);
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
  return formatBatch(tvShows);
}

// ============================================================
// Fetch Latest Episodes
// VPS API tidak punya endpoint khusus episodes,
// return TV shows terbaru sebagai alternatif
// ============================================================
export async function fetchLatestEpisodes(
  page = 1
): Promise<EnrichedMediaItem[]> {
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
// enrichWithTMDB - DEPRECATED, kept for compatibility
// Sekarang cuma format item (no TMDB)
// ============================================================
export async function enrichWithTMDB(
  items: CinemacityContent[],
  _type: "movie" | "tv"
): Promise<EnrichedMediaItem[]> {
  return formatBatch(items);
}

// ============================================================
// Image URL helper
// ============================================================
export function getTMDBImage(
  url: string,
  _size: "w185" | "w342" | "w500" | "w1280" | "original" = "w342"
): string {
  if (!url) return "/placeholder-poster.png";
  // Return as-is (cinemacity URLs atau placeholder)
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
  return formatBatch(results);
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
