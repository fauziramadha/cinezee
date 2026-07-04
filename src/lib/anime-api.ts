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
  detail: 6 * 60 * 60, // 6 jam
  episode: 60 * 60, // 1 jam
  search: 5 * 60, // 5 menit
  genres: 24 * 60 * 60, // 24 jam
  genreBrowse: 60 * 60, // 1 jam
  schedule: 60 * 60, // 1 jam
  server: 0, // NO CACHE (dynamic)
  unlimited: 24 * 60 * 60, // 24 jam (response besar, jarang berubah)
  batch: 60 * 60, // 1 jam (mirip episode)
} as const;

// ============================================================
// TYPES
// ============================================================
export interface AnimeListItem {
  title: string;
  poster?: string;
  episodes?: number;
  releaseDay?: string;
  latestReleaseDate?: string;
  animeId: string;
  href: string;
  otakudesuUrl?: string;
}

export interface AnimeDetail {
  title: string;
  poster?: string;
  synopsis?: string;
  genres?: string[];
  status?: string;
  type?: string;
  episodes?: AnimeEpisode[];
  [key: string]: any;
}

export interface AnimeEpisode {
  title: string;
  episodeSlug: string;
  href: string;
  releaseDate?: string;
}

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
      // Cache expired, delete it
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
  if (ttlSeconds <= 0) return; // Don't cache if TTL is 0

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
    console.error("[Anime API] Cache set error:", error);
  }
}

// ============================================================
// DETERMINE CACHE TTL BY ENDPOINT
// ============================================================
function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/unlimited")) return CACHE_TTL.unlimited;
  if (endpoint.includes("/batch/")) return CACHE_TTL.batch;
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/ongoing-anime")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/complete-anime")) return CACHE_TTL.completed;
  if (endpoint.includes("/anime/anime/")) return CACHE_TTL.detail;
  if (endpoint.includes("/episode/")) return CACHE_TTL.episode;
  if (endpoint.includes("/search/")) return CACHE_TTL.search;
  if (endpoint.includes("/genre") && !endpoint.includes("/genre/"))
    return CACHE_TTL.genres;
  if (endpoint.includes("/genre/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/schedule")) return CACHE_TTL.schedule;
  if (endpoint.includes("/server/")) return CACHE_TTL.server;
  return 5 * 60; // Default 5 menit
}

// ============================================================
// BUILD CACHE KEY
// ============================================================
function buildCacheKey(endpoint: string): string {
  // Normalize: remove leading slash, replace special chars
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `anime_${normalized}`;
}

// ============================================================
// MAIN FETCH FUNCTION (with cache)
// ============================================================
export async function fetchAnimeAPI(
  endpoint: string,
  options: { forceRefresh?: boolean } = {}
): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);

  // Cek cache dulu (kecuali force refresh)
  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[Anime API] Cache HIT: ${endpoint}`);
      return cached;
    }
  }

  // Cache miss, fetch dari API asli
  console.log(`[Anime API] Cache MISS, fetching: ${endpoint}`);
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

    // Simpan ke cache (kalau TTL > 0)
    if (ttl > 0) {
      await setCached(cacheKey, endpoint, data, ttl);
    }

    return data;
  } catch (error) {
    console.error(`[Anime API] Fetch error for ${endpoint}:`, error);

    // Kalau ada cache expired, return itu daripada error
    try {
      const d1 = await getD1();
      const row = await d1
        .prepare("SELECT response_data FROM api_cache WHERE cache_key = ?")
        .bind(cacheKey)
        .first();
      if (row) {
        console.log(`[Anime API] Returning stale cache for: ${endpoint}`);
        return JSON.parse(row.response_data as string);
      }
    } catch {}

    throw error;
  }
}

// ============================================================
// HIGH-LEVEL API FUNCTIONS
// ============================================================

// Halaman utama (ongoing + completed)
export async function getHome() {
  return fetchAnimeAPI("/anime/home");
}

// Anime ongoing (sedang tayang)
export async function getOngoingAnime(page = 1) {
  return fetchAnimeAPI(`/anime/ongoing-anime?page=${page}`);
}

// Anime completed (tamat)
export async function getCompletedAnime(page = 1) {
  return fetchAnimeAPI(`/anime/complete-anime?page=${page}`);
}

// Detail anime + episode list
export async function getAnimeDetail(slug: string) {
  return fetchAnimeAPI(`/anime/anime/${slug}`);
}

// Detail episode + stream links
export async function getEpisode(slug: string) {
  return fetchAPI(`/anime/episode/${slug}`);
}

// Ambil URL server streaming
export async function getServer(serverId: string) {
  return fetchAnimeAPI(`/anime/server/${serverId}`);
}

// Search anime
export async function searchAnime(keyword: string) {
  return fetchAnimeAPI(`/anime/search/${encodeURIComponent(keyword)}`);
}

// Daftar semua genre
export async function getGenres() {
  return fetchAnimeAPI("/anime/genre");
}

// Anime berdasarkan genre
export async function getAnimeByGenre(slug: string, page = 1) {
  return fetchAnimeAPI(`/anime/genre/${slug}?page=${page}`);
}

// Jadwal rilis
export async function getSchedule() {
  return fetchAnimeAPI("/anime/schedule");
}

// ============================================================
// SEMUA ANIME (Unlimited)
// ============================================================

// Ambil semua data anime (response besar, cache 24 jam)
export async function getAllAnime() {
  return fetchAnimeAPI("/anime/unlimited");
}

// ============================================================
// BATCH DOWNLOAD
// ============================================================

// Ambil link download batch untuk anime tertentu
export async function getBatchDownload(slug: string) {
  return fetchAnimeAPI(`/anime/batch/${slug}`);
}

// ============================================================
// CLEANUP FUNCTION (untuk cron job / manual cleanup)
// ============================================================
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const d1 = await getD1();
    const result = await d1
      .prepare("DELETE FROM api_cache WHERE expires_at < datetime('now')")
      .run();
    return (result.meta as any)?.changes || 0;
  } catch {
    return 0;
  }
}
