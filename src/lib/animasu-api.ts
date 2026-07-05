import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// CONFIG
// ============================================================
const API_BASE =
  process.env.ANIME_API_BASE || "https://www.sankavollerei.web.id";

// Cache TTL per endpoint type (dalam detik)
const CACHE_TTL = {
  home: 30 * 60, // 30 menit
  ongoing: 30 * 60, // 30 menit
  completed: 30 * 60, // 30 menit
  popular: 60 * 60, // 1 jam
  movies: 60 * 60, // 1 jam
  latest: 30 * 60, // 30 menit
  detail: 6 * 60 * 60, // 6 jam
  episode: 60 * 60, // 1 jam
  search: 5 * 60, // 5 menit
  genres: 24 * 60 * 60, // 24 jam
  genreBrowse: 60 * 60, // 1 jam
  schedule: 60 * 60, // 1 jam
  animelist: 24 * 60 * 60, // 24 jam
  characters: 24 * 60 * 60, // 24 jam
} as const;

// ============================================================
// D1 HELPER
// ============================================================
async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) {
    return ctx.env.DB as D1Database;
  }
  throw new Error('D1 database binding "DB" not found.');
}

// ============================================================
// CACHE FUNCTIONS
// ============================================================
async function getCached(key: string): Promise<any | null> {
  try {
    const d1 = await getD1();
    const row = await d1
      .prepare(
        "SELECT response_data, expires_at FROM api_cache WHERE cache_key = ?"
      )
      .bind(key)
      .first();

    if (!row) return null;

    const expiresAt = new Date(row.expires_at as string).getTime();
    if (Date.now() > expiresAt) {
      await d1.prepare("DELETE FROM api_cache WHERE cache_key = ?").bind(key).run();
      return null;
    }

    return JSON.parse(row.response_data as string);
  } catch {
    return null;
  }
}

async function setCached(
  key: string,
  endpoint: string,
  data: any,
  ttlSeconds: number
): Promise<void> {
  if (ttlSeconds <= 0) return;

  try {
    const d1 = await getD1();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await d1
      .prepare(
        `INSERT INTO api_cache (cache_key, endpoint, response_data, expires_at, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(cache_key) DO UPDATE SET
           endpoint = excluded.endpoint,
           response_data = excluded.response_data,
           expires_at = excluded.expires_at,
           created_at = datetime('now')`
      )
      .bind(key, endpoint, JSON.stringify(data), expiresAt)
      .run();
  } catch (error) {
    console.error("[Animasu API] Cache set error:", error);
  }
}

// ============================================================
// DETERMINE CACHE TTL BY ENDPOINT
// ============================================================
function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/ongoing")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/completed")) return CACHE_TTL.completed;
  if (endpoint.includes("/popular")) return CACHE_TTL.popular;
  if (endpoint.includes("/movies")) return CACHE_TTL.movies;
  if (endpoint.includes("/latest")) return CACHE_TTL.latest;
  if (endpoint.includes("/detail/")) return CACHE_TTL.detail;
  if (endpoint.includes("/episode/")) return CACHE_TTL.episode;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/genres") && !endpoint.includes("/genre/"))
    return CACHE_TTL.genres;
  if (endpoint.includes("/genre/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/schedule")) return CACHE_TTL.schedule;
  if (endpoint.includes("/animelist")) return CACHE_TTL.animelist;
  if (endpoint.includes("/characters")) return CACHE_TTL.characters;
  return 5 * 60; // Default 5 menit
}

// ============================================================
// BUILD CACHE KEY (prefix "animasu_" supaya tidak bentrok)
// ============================================================
function buildCacheKey(endpoint: string): string {
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `animasu_${normalized}`;
}

// ============================================================
// MAIN FETCH FUNCTION
// ============================================================
export async function fetchAnimasuAPI(
  endpoint: string,
  options: { forceRefresh?: boolean } = {}
): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);

  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[Animasu API] Cache HIT: ${endpoint}`);
      return cached;
    }
  }

  console.log(`[Animasu API] Cache MISS, fetching: ${endpoint}`);
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CineStream/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (ttl > 0) {
      await setCached(cacheKey, endpoint, data, ttl);
    }

    return data;
  } catch (error) {
    console.error(`[Animasu API] Fetch error for ${endpoint}:`, error);

    // Fallback ke stale cache
    try {
      const d1 = await getD1();
      const row = await d1
        .prepare("SELECT response_data FROM api_cache WHERE cache_key = ?")
        .bind(cacheKey)
        .first();
      if (row) {
        console.log(`[Animasu API] Returning stale cache for: ${endpoint}`);
        return JSON.parse(row.response_data as string);
      }
    } catch {}

    throw error;
  }
}

// ============================================================
// HIGH-LEVEL API FUNCTIONS
// ============================================================

// Halaman utama (ongoing + recent)
export async function getHome() {
  return fetchAnimasuAPI("/anime/animasu/home");
}

// Anime ongoing
export async function getOngoing(page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/ongoing?page=${page}`);
}

// Anime completed
export async function getCompleted(page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/completed?page=${page}`);
}

// Anime populer
export async function getPopular(page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/popular?page=${page}`);
}

// Anime movie
export async function getMovies(page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/movies?page=${page}`);
}

// Anime terbaru (latest)
export async function getLatest(page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/latest?page=${page}`);
}

// Search anime
export async function searchAnime(keyword: string, page = 1) {
  return fetchAnimasuAPI(
    `/anime/animasu/search/${encodeURIComponent(keyword)}?page=${page}`
  );
}

// Daftar A-Z
export async function getAnimeList(letter = "A", page = 1) {
  return fetchAnimasuAPI(
    `/anime/animasu/animelist?letter=${letter}&page=${page}`
  );
}

// Daftar genre
export async function getGenres() {
  return fetchAnimasuAPI("/anime/animasu/genres");
}

// Anime berdasarkan genre
export async function getAnimeByGenre(slug: string, page = 1) {
  return fetchAnimasuAPI(`/anime/animasu/genre/${slug}?page=${page}`);
}

// Jadwal rilis
export async function getSchedule() {
  return fetchAnimasuAPI("/anime/animasu/schedule");
}

// Detail anime
export async function getAnimeDetail(slug: string) {
  return fetchAnimasuAPI(`/anime/animasu/detail/${slug}`);
}

// Detail episode (langsung dapat streams[])
export async function getEpisode(slug: string) {
  return fetchAnimasuAPI(`/anime/animasu/episode/${slug}`);
}

// ============================================================
// HELPER: Normalize AnimeListItem (supaya compatible dengan UI)
// ============================================================
export interface NormalizedAnimeItem {
  title: string;
  poster?: string;
  episodes?: number | string;
  releaseDay?: string;
  latestReleaseDate?: string;
  animeId: string; // pakai field ini untuk kompatibilitas UI
  href: string;
  source: "animasu";
}

export function normalizeAnimeItem(raw: any): NormalizedAnimeItem {
  return {
    title: raw.title || "Untitled",
    poster: raw.poster || null,
    episodes: raw.episode,
    latestReleaseDate: raw.status_or_day,
    animeId: raw.slug, // Map slug → animeId untuk UI compatibility
    href: `/anime/animasu/${raw.slug}`,
    source: "animasu",
  };
}

export function normalizeAnimeList(rawList: any[] = []): NormalizedAnimeItem[] {
  return rawList.map(normalizeAnimeItem);
}
