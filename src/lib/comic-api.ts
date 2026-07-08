import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BASE = "https://indocast.site/api/komiku";

// Cache TTL (hemat request supaya tidak kena blokir)
const CACHE_TTL = {
  home: 6 * 60 * 60,        // 6 jam
  terbaru: 1 * 60 * 60,     // 1 jam
  populer: 6 * 60 * 60,     // 6 jam
  trending: 6 * 60 * 60,    // 6 jam
  search: 30 * 60,          // 30 menit
  detail: 12 * 60 * 60,     // 12 jam
  view: 6 * 60 * 60,        // 6 jam (chapter image cache)
  filters: 24 * 60 * 60,    // 24 jam
} as const;

async function getD1(): Promise<D1Database> {
  const ctx = await getCloudflareContext();
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  throw new Error('D1 database binding "DB" not found.');
}

async function getCached(key: string): Promise<{ data: any; isFresh: boolean } | null> {
  try {
    const d1 = await getD1();
    const row = await d1
      .prepare("SELECT response_data, expires_at FROM api_cache WHERE cache_key = ?")
      .bind(key)
      .first();
    if (!row) return null;
    const expiresAt = new Date(row.expires_at as string).getTime();
    const isFresh = Date.now() <= expiresAt;
    return { data: JSON.parse(row.response_data as string), isFresh };
  } catch {
    return null;
  }
}

async function setCached(key: string, endpoint: string, data: any, ttl: number): Promise<void> {
  if (ttl <= 0) return;
  try {
    const d1 = await getD1();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
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
  } catch (e) {
    console.error("[Comic API] Cache set error:", e);
  }
}

function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/terbaru")) return CACHE_TTL.terbaru;
  if (endpoint.includes("/populer")) return CACHE_TTL.populer;
  if (endpoint.includes("/trending")) return CACHE_TTL.trending;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/detail")) return CACHE_TTL.detail;
  if (endpoint.includes("/view")) return CACHE_TTL.view;
  if (endpoint.includes("/filters")) return CACHE_TTL.filters;
  return 30 * 60;
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `comic_${normalized}`;
}

async function getApiKey(): Promise<string | null> {
  try {
    const ctx = await getCloudflareContext();
    return (ctx?.env?.INDOCAST_API_KEY as string) || null;
  } catch {
    return null;
  }
}

export async function fetchComicAPI(
  endpoint: string,
  options: { forceRefresh?: boolean } = {}
): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);

  // Check cache
  const cached = await getCached(cacheKey);
  if (cached) {
    if (cached.isFresh && !options.forceRefresh) {
      console.log(`[Comic API] Cache HIT (fresh): ${endpoint}`);
      return cached.data;
    }
    console.log(`[Comic API] Cache HIT (stale), will refresh: ${endpoint}`);
  } else {
    console.log(`[Comic API] Cache MISS, fetching: ${endpoint}`);
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error("[Comic API] INDOCAST_API_KEY not set in environment");
    if (cached) return cached.data;
    throw new Error("INDOCAST_API_KEY not configured");
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": "CineStream/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (ttl > 0) await setCached(cacheKey, endpoint, data, ttl);
    return data;
  } catch (error) {
    console.error(`[Comic API] Fetch error for ${endpoint}:`, error);
    // Serve stale cache if we have one
    if (cached) {
      console.log(`[Comic API] Serving stale cache for: ${endpoint}`);
      return cached.data;
    }
    throw error;
  }
}

// ============================================================
// HIGH-LEVEL API FUNCTIONS
// ============================================================

export const comic = {
  // Home page (slider, populer, terbaru)
  getHome: () => fetchComicAPI("/home/home"),

  // Komik terbaru
  getTerbaru: (page = 1) => fetchComicAPI(`/terbaru?page=${page}`),

  // Komik populer
  getPopuler: (page = 1) => fetchComicAPI(`/populer?page=${page}`),

  // Komik populer dengan filter (tipe, orderby)
  getPopulerFiltered: (endpoint: string) => fetchComicAPI(endpoint),
  
  // Search komik
  search: (keyword: string) =>
    fetchComicAPI(`/search?q=${encodeURIComponent(keyword)}`),

  // Detail komik
  getDetail: (slug: string) => fetchComicAPI(`/detail/${slug}`),

  // Baca chapter (view)
  getView: (slug: string) => fetchComicAPI(`/view/${slug}`),

  // Filters (genre list, dll)
  getFilters: () => fetchComicAPI("/filters"),
};
