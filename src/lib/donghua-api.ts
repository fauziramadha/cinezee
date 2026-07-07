import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BASE =
  process.env.ANIME_API_BASE || "https://www.sankavollerei.web.id";

// Jina Reader API acts as a proxy to bypass Cloudflare Workers block.
// sankavollerei.web.id blocks requests that contain CF-Connecting-IP header
// (which Cloudflare Workers auto-adds to all outgoing fetches).
// Jina is hosted outside CF, so it can fetch the API without being blocked.
const PROXY_PREFIX = "https://r.jina.ai/";

const CACHE_TTL = {
  home: 30 * 60,
  ongoing: 30 * 60,
  completed: 30 * 60,
  latest: 30 * 60,
  popular: 60 * 60,
  movie: 60 * 60,
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
  if (endpoint.includes("/home")) return CACHE_TTL.home;
  if (endpoint.includes("/ongoing")) return CACHE_TTL.ongoing;
  if (endpoint.includes("/completed")) return CACHE_TTL.completed;
  if (endpoint.includes("/latest")) return CACHE_TTL.latest;
  if (endpoint.includes("/popular")) return CACHE_TTL.popular;
  if (endpoint.includes("/movie")) return CACHE_TTL.movie;
  if (endpoint.includes("/detail/")) return CACHE_TTL.detail;
  if (endpoint.includes("/episode/")) return CACHE_TTL.episode;
  if (endpoint.includes("/search")) return CACHE_TTL.search;
  if (endpoint.includes("/genres") && !endpoint.includes("/genres/")) return CACHE_TTL.genres;
  if (endpoint.includes("/genres/") || endpoint.includes("/genre/")) return CACHE_TTL.genreBrowse;
  if (endpoint.includes("/schedule")) return CACHE_TTL.schedule;
  return 5 * 60;
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint.replace(/^\//, "").replace(/\?/g, "_").replace(/&/g, "_").replace(/=/g, "_").replace(/\//g, "_");
  return `donghua_${normalized}`;
}

export async function fetchDonghuaAPI(endpoint: string, options: { forceRefresh?: boolean } = {}): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = getCacheTtl(endpoint);
  if (!options.forceRefresh && ttl > 0) {
    const cached = await getCached(cacheKey);
    if (cached) { console.log(`[Donghua API] Cache HIT: ${endpoint}`); return cached; }
  }
  console.log(`[Donghua API] Cache MISS, fetching: ${endpoint}`);

  const originalUrl = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  // Route through Jina Reader proxy to bypass Cloudflare Workers block
  const proxiedUrl = `${PROXY_PREFIX}${originalUrl}`;

  try {
    const response = await fetch(proxiedUrl, {
      headers: {
        // Jina returns structured JSON when Accept: application/json is set
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      },
    });
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);

    const raw = await response.json();

    // Jina response shape: { code, status, data: { title, description, url, content } }
    // `content` is the original JSON as a string — we need to parse it
    let data: any = raw;
    if (raw && typeof raw === "object" && raw.data && typeof raw.data.content === "string") {
      try {
        data = JSON.parse(raw.data.content);
      } catch {
        // If content isn't valid JSON, fall back to raw response
        data = raw.data;
      }
    }

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
// SERVER 1 (🐉 Anichin) — /anime/donghua/...
// ============================================================
export const s1 = {
  getHome: (page = 1) => fetchDonghuaAPI(`/anime/donghua/home/${page}`),
  getOngoing: (page = 1) => fetchDonghuaAPI(`/anime/donghua/ongoing/${page}`),
  getCompleted: (page = 1) => fetchDonghuaAPI(`/anime/donghua/completed/${page}`),
  getLatest: (page = 1) => fetchDonghuaAPI(`/anime/donghua/latest/${page}`),
  getDetail: (slug: string) => fetchDonghuaAPI(`/anime/donghua/detail/${slug}`),
  getEpisode: (slug: string) => fetchDonghuaAPI(`/anime/donghua/episode/${slug}`),
  search: (keyword: string, page = 1) => fetchDonghuaAPI(`/anime/donghua/search/${encodeURIComponent(keyword)}/${page}`),
  getGenres: () => fetchDonghuaAPI(`/anime/donghua/genres`),
  getByGenre: (slug: string, page = 1) => fetchDonghuaAPI(`/anime/donghua/genres/${slug}/${page}`),
  getSchedule: () => fetchDonghuaAPI(`/anime/donghua/schedule`),
};

// ============================================================
// SERVER 2 (🐼 Donghub) — /anime/donghub/...
// ============================================================
export const s2 = {
  getHome: () => fetchDonghuaAPI(`/anime/donghub/home`),
  getLatest: () => fetchDonghuaAPI(`/anime/donghub/latest`),
  getPopular: () => fetchDonghuaAPI(`/anime/donghub/popular`),
  getMovie: () => fetchDonghuaAPI(`/anime/donghub/movie`),
  getDetail: (slug: string) => fetchDonghuaAPI(`/anime/donghub/detail/${slug}`),
  getEpisode: (slug: string) => fetchDonghuaAPI(`/anime/donghub/episode/${slug}`),
  search: (keyword: string, page = 1) => fetchDonghuaAPI(`/anime/donghub/search/${encodeURIComponent(keyword)}/${page}`),
  getGenres: () => fetchDonghuaAPI(`/anime/donghub/genres`),
  getByGenre: (slug: string, page = 1) => fetchDonghuaAPI(`/anime/donghub/list?genre=${slug}&page=${page}`),
  getSchedule: () => fetchDonghuaAPI(`/anime/donghub/schedule`),
};
