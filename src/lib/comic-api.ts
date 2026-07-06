import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BASE =
  process.env.ANIME_API_BASE || "https://www.sankavollerei.web.id";

const CACHE_TTL = {
  homepage: 30 * 60,
  terbaru: 30 * 60,
  populer: 60 * 60,
  trending: 60 * 60,
  detail: 6 * 60 * 60,
  chapter: 60 * 60,
  search: 5 * 60,
  genres: 24 * 60 * 60,
  genreBrowse: 60 * 60,
  browse: 60 * 60,
  type: 60 * 60,
  random: 5 * 60,
  recommendations: 60 * 60,
  navigation: 60 * 60,
  berwarna: 60 * 60,
  pustaka: 60 * 60,
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
  } catch (e) { console.error("[Comic API] Cache set error:", e); }
}

function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/homepage")) return CACHE_TTL.homepage;
  if (endpoint.includes("/terbaru")) return CACHE_TTL.terbaru;
  if (endpoint.includes("/populer")) return CACHE_TTL.populer;
  if (endpoint.includes("/trending")) return CACHE_TTL.trending;
  if (endpoint.includes("/detail/") || endpoint.includes("/comic/")) return CACHE_TTL.detail;
  if (endpoint.includes("/chapter/") && endpoint.includes("/navigation")) return CACHE_TTL.navigation;
  if (endpoint.includes("/chapter/")) return CACHE_TTL.chapter;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/genres") && !endpoint.includes("/genre/")) return CACHE_TTL.genres;
  if (endpoint.includes("/genre/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/browse")) return CACHE_TTL.browse;
  if (endpoint.includes("/type/")) return CACHE_TTL.type;
  if (endpoint.includes("/random")) return CACHE_TTL.random;
  if (endpoint.includes("/recommendations")) return CACHE_TTL.recommendations;
  if (endpoint.includes("/berwarna")) return CACHE_TTL.berwarna;
  if (endpoint.includes("/pustaka")) return CACHE_TTL.pustaka;
  return 5 * 60;
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint.replace(/^\//, "").replace(/\?/g, "_").replace(/&/g, "_").replace(/=/g, "_").replace(/\//g, "_");
  return `comic_${normalized}`;
}

export async function fetchComicAPI(endpoint: string, options: { forceRefresh?: boolean } = {}): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);
  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) { console.log(`[Comic API] Cache HIT: ${endpoint}`); return cached; }
  }
  console.log(`[Comic API] Cache MISS, fetching: ${endpoint}`);
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "CineStream/1.0" } });
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);
    const data = await response.json();
    if (ttl > 0) await setCached(cacheKey, endpoint, data, ttl);
    return data;
  } catch (error) {
    console.error(`[Comic API] Fetch error for ${endpoint}:`, error);
    try {
      const d1 = await getD1();
      const row = await d1.prepare("SELECT response_data FROM api_cache WHERE cache_key = ?").bind(cacheKey).first();
      if (row) { console.log(`[Comic API] Returning stale cache for: ${endpoint}`); return JSON.parse(row.response_data as string); }
    } catch {}
    throw error;
  }
}

// === HIGH-LEVEL API ===
export async function getHomepage() { return fetchComicAPI(`/comic/homepage`); }
export async function getTerbaru() { return fetchComicAPI(`/comic/terbaru`); }
export async function getPopuler() { return fetchComicAPI(`/comic/populer`); }
export async function getTrending() { return fetchComicAPI(`/comic/trending`); }
export async function getDetail(slug: string) { return fetchComicAPI(`/comic/comic/${slug}`); }
export async function getChapter(slug: string) { return fetchComicAPI(`/comic/chapter/${slug}`); }
export async function getChapterNavigation(slug: string) { return fetchComicAPI(`/comic/chapter/${slug}/navigation`); }
export async function searchComic(query: string) { return fetchComicAPI(`/comic/search?q=${encodeURIComponent(query)}`); }
export async function getGenres() { return fetchComicAPI(`/comic/genres`); }
export async function getByGenre(genre: string) { return fetchComicAPI(`/comic/genre/${genre}`); }
export async function getByType(type: string) { return fetchComicAPI(`/comic/type/${type}`); }
export async function getRandom() { return fetchComicAPI(`/comic/random`); }
export async function getRecommendations() { return fetchComicAPI(`/comic/recommendations`); }
export async function getBerwarna(page = 1) { return fetchComicAPI(`/comic/berwarna/${page}`); }
export async function getPustaka(page = 1) { return fetchComicAPI(`/comic/pustaka/${page}`); }
export async function getBrowse(params?: { type?: string; order?: string; genre?: string }) {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.order) query.set("order", params.order);
  if (params?.genre) query.set("genre", params.genre);
  const qs = query.toString();
  return fetchComicAPI(`/comic/browse${qs ? `?${qs}` : ""}`);
}
