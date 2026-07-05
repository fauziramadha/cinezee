import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// CONFIG
// ============================================================
const API_BASE =
  process.env.ANIME_API_BASE || "https://www.sankavollerei.web.id";

// Cache TTL (sama dengan Otakudesu, tapi beda prefix cache key)
const CACHE_TTL = {
  home: 30 * 60, // 30 menit
  recent: 30 * 60, // 30 menit
  ongoing: 30 * 60, // 30 menit
  completed: 30 * 60, // 30 menit
  popular: 60 * 60, // 1 jam
  movies: 60 * 60, // 1 jam
  detail: 6 * 60 * 60, // 6 jam
  episode: 60 * 60, // 1 jam
  search: 5 * 60, // 5 menit
  genres: 24 * 60 * 60, // 24 jam
  genreBrowse: 60 * 60, // 1 jam
  schedule: 60 * 60, // 1 jam
  batch: 60 * 60, // 1 jam
  server: 0, // NO CACHE
  batchList: 60 * 60, // 1 jam
} as const;

// ============================================================
// D1 HELPER (reuse dari anime-api.ts)
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
    console.error("[Samehadaku API] Cache set error:", error);
  }
}

// ============================================================
// DETERMINE CACHE TTL BY ENDPOINT
// ============================================================
function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/server/")) return CACHE_TTL.server;
  if (endpoint.includes("/batch/")) return CACHE_TTL.batch;
  if (endpoint.includes("/batchList")) return CACHE_TTL.batchList;
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/recent")) return CACHE_TTL.recent;
  if (endpoint.includes("/ongoing")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/completed")) return CACHE_TTL.completed;
  if (endpoint.includes("/popular")) return CACHE_TTL.popular;
  if (endpoint.includes("/movies")) return CACHE_TTL.movies;
  if (endpoint.includes("/anime/")) return CACHE_TTL.detail;
  if (endpoint.includes("/episode/")) return CACHE_TTL.episode;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/genres") && !endpoint.includes("/genres/"))
    return CACHE_TTL.genres;
  if (endpoint.includes("/genres/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/schedule")) return CACHE_TTL.schedule;
  return 5 * 60; // Default 5 menit
}

// ============================================================
// BUILD CACHE KEY (prefix "samehadaku_" supaya tidak bentrok)
// ============================================================
function buildCacheKey(endpoint: string): string {
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `samehadaku_${normalized}`;
}

// ============================================================
// MAIN FETCH FUNCTION
// ============================================================
export async function fetchSamehadakuAPI(
  endpoint: string,
  options: { forceRefresh?: boolean } = {}
): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);

  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log(`[Samehadaku API] Cache HIT: ${endpoint}`);
      return cached;
    }
  }

  console.log(`[Samehadaku API] Cache MISS, fetching: ${endpoint}`);
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
    console.error(`[Samehadaku API] Fetch error for ${endpoint}:`, error);

    // Fallback ke stale cache kalau ada
    try {
      const d1 = await getD1();
      const row = await d1
        .prepare("SELECT response_data FROM api_cache WHERE cache_key = ?")
        .bind(cacheKey)
        .first();
      if (row) {
        console.log(`[Samehadaku API] Returning stale cache for: ${endpoint}`);
        return JSON.parse(row.response_data as string);
      }
    } catch {}

    throw error;
  }
}

// ============================================================
// HIGH-LEVEL API FUNCTIONS
// ============================================================

// Halaman utama (recent releases)
export async function getHome() {
  return fetchSamehadakuAPI("/anime/samehadaku/home");
}

// Anime terbaru (recent releases)
export async function getRecent(page = 1) {
  return fetchSamehadakuAPI(`/anime/samehadaku/recent?page=${page}`);
}

// Anime sedang tayang
export async function getOngoing(page = 1, order = "popular") {
  return fetchSamehadakuAPI(
    `/anime/samehadaku/ongoing?page=${page}&order=${order}`
  );
}

// Anime tamat
export async function getCompleted(page = 1, order = "latest") {
  return fetchSamehadakuAPI(
    `/anime/samehadaku/completed?page=${page}&order=${order}`
  );
}

// Anime populer
export async function getPopular(page = 1) {
  return fetchSamehadakuAPI(`/anime/samehadaku/popular?page=${page}`);
}

// Anime movie
export async function getMovies(page = 1, order = "update") {
  return fetchSamehadakuAPI(
    `/anime/samehadaku/movies?page=${page}&order=${order}`
  );
}

// Semua anime (list)
export async function getAllAnime() {
  return fetchSamehadakuAPI("/anime/samehadaku/list");
}

// Search anime
export async function searchAnime(keyword: string, page = 1) {
  return fetchSamehadakuAPI(
    `/anime/samehadaku/search?q=${encodeURIComponent(keyword)}&page=${page}`
  );
}

// Daftar genre
export async function getGenres() {
  return fetchSamehadakuAPI("/anime/samehadaku/genres");
}

// Anime berdasarkan genre
export async function getAnimeByGenre(genreId: string, page = 1) {
  return fetchSamehadakuAPI(
    `/anime/samehadaku/genres/${genreId}?page=${page}`
  );
}

// Jadwal rilis
export async function getSchedule() {
  return fetchSamehadakuAPI("/anime/samehadaku/schedule");
}

// Detail anime
export async function getAnimeDetail(animeId: string) {
  return fetchSamehadakuAPI(`/anime/samehadaku/anime/${animeId}`);
}

// Detail episode (stream links)
export async function getEpisode(episodeId: string) {
  return fetchSamehadakuAPI(`/anime/samehadaku/episode/${episodeId}`);
}

// Link server streaming
export async function getServer(serverId: string) {
  return fetchSamehadakuAPI(`/anime/samehadaku/server/${serverId}`);
}

// Detail batch download
export async function getBatchDetail(batchId: string) {
  return fetchSamehadakuAPI(`/anime/samehadaku/batch/${batchId}`);
}

// Daftar batch
export async function getBatchList(page = 1) {
  return fetchSamehadakuAPI(`/anime/samehadaku/batch?page=${page}`);
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
  animeId: string;
  href: string;
  source: "samehadaku";
}

export function normalizeAnimeItem(raw: any): NormalizedAnimeItem {
  return {
    title: raw.title || "Untitled",
    poster: raw.poster || null,
    episodes: raw.episodes ? parseInt(String(raw.episodes), 10) || raw.episodes : undefined,
    latestReleaseDate: raw.releasedOn || raw.latestReleaseDate,
    animeId: raw.animeId,
    href: raw.href,
    source: "samehadaku",
  };
}

export function normalizeAnimeList(rawList: any[] = []): NormalizedAnimeItem[] {
  return rawList.map(normalizeAnimeItem);
}
