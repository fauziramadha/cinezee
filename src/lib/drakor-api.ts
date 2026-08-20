import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BASE = "https://indocast.site/api/drakorid";

// Cache TTL (hemat request supaya tidak kena blokir)
const CACHE_TTL = {
  home: 6 * 60 * 60,
  terbaru: 1 * 60 * 60,
  ongoing: 6 * 60 * 60,
  trending: 6 * 60 * 60,
  search: 30 * 60,
  detail: 12 * 60 * 60,
  play: 6 * 60 * 60,
  kategori: 24 * 60 * 60,
  kategoriDetail: 6 * 60 * 60,
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
    console.error("[Drakor API] Cache set error:", e);
  }
}

function getCacheTtl(endpoint: string): number {
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/terbaru")) return CACHE_TTL.terbaru;
  if (endpoint.includes("/ongoing")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/trending")) return CACHE_TTL.trending;
  if (endpoint.includes("/cari") || endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/details")) return CACHE_TTL.detail;
  if (endpoint.includes("/play")) return CACHE_TTL.play;
  if (endpoint.includes("/kategori/detail")) return CACHE_TTL.kategoriDetail;
  if (endpoint.includes("/kategori")) return CACHE_TTL.kategori;
  return 30 * 60;
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `drakor_${normalized}`;
}

async function getApiKey(): Promise<string | null> {
  try {
    const ctx = await getCloudflareContext();
    return (ctx?.env?.INDOCAST_API_KEY as string) || null;
  } catch {
    return null;
  }
}

export async function fetchDrakorAPI(
  endpoint: string,
  options: { forceRefresh?: boolean } = {}
): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);

  const cached = await getCached(cacheKey);
  if (cached) {
    if (cached.isFresh && !options.forceRefresh) {
      console.log(`[Drakor API] Cache HIT (fresh): ${endpoint}`);
      return cached.data;
    }
    console.log(`[Drakor API] Cache HIT (stale), will refresh: ${endpoint}`);
  } else {
    console.log(`[Drakor API] Cache MISS, fetching: ${endpoint}`);
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error("[Drakor API] INDOCAST_API_KEY not set in environment");
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
    console.error(`[Drakor API] Fetch error for ${endpoint}:`, error);
    if (cached) {
      console.log(`[Drakor API] Serving stale cache for: ${endpoint}`);
      return cached.data;
    }
    throw error;
  }
}

// POST request for play endpoint
export async function postDrakorAPI(
  endpoint: string,
  body: { id: string; episode: string; quality?: string }
): Promise<any> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("INDOCAST_API_KEY not configured");
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const cacheKey = `drakor_play_${body.id}_${body.episode}_${body.quality || "default"}`;

  // Check cache first
  const cached = await getCached(cacheKey);
  if (cached?.isFresh) {
    console.log(`[Drakor API] Play cache HIT: ${cacheKey}`);
    return cached.data;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "User-Agent": "CineStream/1.0",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    await setCached(cacheKey, endpoint, data, CACHE_TTL.play);
    return data;
  } catch (error) {
    console.error(`[Drakor API] Play fetch error:`, error);
    if (cached) return cached.data;
    throw error;
  }
}

// ============================================================
// HIGH-LEVEL API FUNCTIONS
// ============================================================

export const drakor = {
  // Drama ongoing
  getOngoing: (page = 1) => fetchDrakorAPI(`/ongoing?page=${page}`),

  // Drama trending
  getTrending: () => fetchDrakorAPI(`/trending`),

  // Drama terbaru
  getTerbaru: (page = 1) => fetchDrakorAPI(`/terbaru?page=${page}`),

  // Search drama
  search: (keyword: string, page = 1) =>
    fetchDrakorAPI(`/cari?q=${encodeURIComponent(keyword)}&page=${page}`),

  // Detail drama
  getDetail: (slug: string) => fetchDrakorAPI(`/details?slug=${encodeURIComponent(slug)}`),

  // List kategori
  getKategori: () => fetchDrakorAPI(`/kategori`),

  // Drama by kategori
  getByKategori: (slug: string, page = 1) =>
    fetchDrakorAPI(`/kategori/detail?slug=${encodeURIComponent(slug)}&page=${page}`),

  // Play stream URL (POST request)
  getPlay: (id: string, episode: string, quality?: string) =>
    postDrakorAPI(`/play`, { id, episode, quality }),
};
