import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// VPS FastAPI (Anichin scraper) — Task 3 fix (2026-08-25)
// ------------------------------------------------------------
// BEFORE: API_BASE = https://api.cinestream.biz.id/anichin-api
//   -> Cloudflare Worker -> CF Edge (api.cinestream.biz.id is CF-proxied)
//   -> CF detects same-zone loop and returns HTTP 403 "error code: 1000".
//
// AFTER: API_BASE = http://45.32.100.252/anichin-api-internal
//   -> Worker fetches the VPS DIRECTLY on port 80 (no Cloudflare in path).
//   -> nginx requires the X-Internal-Auth header on /anichin-api-internal/
//      and proxies to FastAPI /anichin-api/ (path rewrite).
//   -> Bypasses the CF loop entirely. Authenticated by the secret header.
//
// To rotate the secret: change it in nginx /opt/cinestream/default.conf
// (location /anichin-api-internal/) AND here (or set as CF Worker secret
// DONGHUA_INTERNAL_AUTH in the Cloudflare dashboard).
// ============================================================
const VPS_IP = "45.32.100.252";
const INTERNAL_AUTH_SECRET =
  process.env.DONGHUA_INTERNAL_AUTH ||
  "cs1-internal-cfworker-bypass-7f3a9b2e8c1d";

const API_BASE =
  process.env.DONGHUA_API_BASE ||
  `http://${VPS_IP}/anichin-api-internal`;

const CACHE_TTL = {
  home: 30 * 60,
  ongoing: 30 * 60,
  completed: 30 * 60,
  latest: 30 * 60,
  popular: 60 * 60,
  detail: 6 * 60 * 60,
  episode: 60 * 60,
  search: 5 * 60,
  genres: 24 * 60 * 60,
  genreBrowse: 60 * 60,
  schedule: 60 * 60,
} as const;

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  throw new Error('D1 database binding "DB" not found.');
}

async function getCached(key: string): Promise<any | null> {
  try {
    const d1 = await getD1();
    const row = await d1.prepare("SELECT response_data, expires_at FROM api_cache WHERE cache_key = ?").bind(key).first();
    if (!row) return null;
    const expiresAt = new Date(row.expires_at as string).getTime();
    if (Date.now() > expiresAt) {
      await d1.prepare("DELETE FROM api_cache WHERE cache_key = ?").bind(key).run();
      return null;
    }
    return JSON.parse(row.response_data as string);
  } catch { return null; }
}

async function setCached(key: string, endpoint: string, data: any, ttl: number): Promise<void> {
  if (ttl <= 0) return;
  try {
    const d1 = await getD1();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    await d1.prepare(
      `INSERT INTO api_cache (cache_key, endpoint, response_data, expires_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(cache_key) DO UPDATE SET endpoint=excluded.endpoint, response_data=excluded.response_data, expires_at=excluded.expires_at, created_at=datetime('now')`
    ).bind(key, endpoint, JSON.stringify(data), expiresAt).run();
  } catch (e) { console.error("[Donghua API] Cache set error:", e); }
}

function getCacheTtl(endpoint: string): number {
  if (endpoint === "/" || endpoint === "" || endpoint === "/home") return CACHE_TTL.home;
  if (endpoint.includes("/ongoing")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/completed")) return CACHE_TTL.completed;
  if (endpoint.includes("/latest")) return CACHE_TTL.latest;
  if (endpoint.includes("/popular")) return CACHE_TTL.popular;
  if (endpoint.includes("/detail/")) return CACHE_TTL.detail;
  if (endpoint.includes("/episode/")) return CACHE_TTL.episode;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/genres") && !endpoint.includes("/genre/")) return CACHE_TTL.genres;
  if (endpoint.includes("/genre/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/schedule")) return CACHE_TTL.schedule;
  return 5 * 60;
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint.replace(/^\//, "").replace(/\?/g, "_").replace(/&/g, "_").replace(/=/g, "_").replace(/\//g, "_");
  return `donghua_v2_${normalized}`;
}

export async function fetchDonghuaAPI(endpoint: string, options: { forceRefresh?: boolean } = {}): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);
  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) { console.log(`[Donghua API] Cache HIT: ${endpoint}`); return cached; }
  }
  console.log(`[Donghua API] Cache MISS, fetching: ${endpoint}`);
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; CineStream/1.0)",
        "X-Internal-Auth": INTERNAL_AUTH_SECRET,
      },
    });
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);
    const data = await response.json();
    if (ttl > 0) await setCached(cacheKey, endpoint, data, ttl);
    return data;
  } catch (error) {
    console.error(`[Donghua API] Fetch error for ${endpoint}:`, error);
    try {
      const d1 = await getD1();
      const row = await d1.prepare("SELECT response_data FROM api_cache WHERE cache_key = ?").bind(cacheKey).first();
      if (row) { console.log(`[Donghua API] Returning stale cache for: ${endpoint}`); return JSON.parse(row.response_data as string); }
    } catch {}
    throw error;
  }
}

// ============================================================
// SERVER 1 (🐉 Anichin via VPS FastAPI) — query-param pagination
// ============================================================
export const s1 = {
  getHome: () => fetchDonghuaAPI(`/home`),
  getOngoing: (page = 1) => fetchDonghuaAPI(`/ongoing?page=${page}`),
  getCompleted: (page = 1) => fetchDonghuaAPI(`/completed?page=${page}`),
  getLatest: (page = 1) => fetchDonghuaAPI(`/latest?page=${page}`),
  getPopular: (page = 1) => fetchDonghuaAPI(`/popular?page=${page}`),
  getDetail: (slug: string) => fetchDonghuaAPI(`/detail/${slug}`),
  getEpisode: (slug: string) => fetchDonghuaAPI(`/episode/${slug}`),
  search: (keyword: string, page = 1) => fetchDonghuaAPI(`/search?q=${encodeURIComponent(keyword)}&page=${page}`),
  getGenres: () => fetchDonghuaAPI(`/genres`),
  getByGenre: (slug: string, page = 1) => fetchDonghuaAPI(`/genre/${slug}?page=${page}`),
  getSchedule: () => fetchDonghuaAPI(`/schedule`),
};

// ============================================================
// SERVER 2 (🐼 Donghub) — kept for backward compat (not used)
// ============================================================
export const s2 = {
  getHome: () => fetchDonghuaAPI(`/`),
  getLatest: () => fetchDonghuaAPI(`/latest?page=1`),
  getPopular: () => fetchDonghuaAPI(`/popular?page=1`),
  getDetail: (slug: string) => fetchDonghuaAPI(`/detail/${slug}`),
  getEpisode: (slug: string) => fetchDonghuaAPI(`/episode/${slug}`),
  search: (keyword: string, page = 1) => fetchDonghuaAPI(`/search?q=${encodeURIComponent(keyword)}&page=${page}`),
  getGenres: () => fetchDonghuaAPI(`/genres`),
  getByGenre: (slug: string, page = 1) => fetchDonghuaAPI(`/genre/${slug}?page=${page}`),
  getSchedule: () => fetchDonghuaAPI(`/schedule`),
};
