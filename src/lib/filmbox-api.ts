import { getCloudflareContext } from "@opennextjs/cloudflare";

const API_BASE = "https://indocast.site/api/filmbox";

const CACHE_TTL = {
  trending: 6 * 60 * 60,
  search: 6 * 60 * 60,
  detail: 24 * 60 * 60,
  play: 12 * 60 * 60,
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
    console.error("[Filmbox API] Cache set error:", e);
  }
}

function buildCacheKey(endpoint: string): string {
  const normalized = endpoint
    .replace(/^\//, "")
    .replace(/\?/g, "_")
    .replace(/&/g, "_")
    .replace(/=/g, "_")
    .replace(/\//g, "_");
  return `filmbox_${normalized}`;
}

async function getApiKey(): Promise<string | null> {
  try {
    const ctx = await getCloudflareContext();
    return (ctx?.env?.INDOCAST_API_KEY as string) || null;
  } catch {
    return null;
  }
}

async function fetchFilmboxAPI(endpoint: string): Promise<any> {
  const cacheKey = buildCacheKey(endpoint);
  const ttl = endpoint.includes("/play") ? CACHE_TTL.play
    : endpoint.includes("/details") ? CACHE_TTL.detail
    : endpoint.includes("/search") ? CACHE_TTL.search
    : endpoint.includes("/trending") ? CACHE_TTL.trending
    : 30 * 60;

  const cached = await getCached(cacheKey);
  if (cached?.isFresh) {
    console.log(`[Filmbox API] Cache HIT: ${endpoint}`);
    return cached.data;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
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
    console.error(`[Filmbox API] Fetch error for ${endpoint}:`, error);
    if (cached) {
      console.log(`[Filmbox API] Serving stale cache for: ${endpoint}`);
      return cached.data;
    }
    throw error;
  }
}

// POST request for search endpoint
async function postFilmboxAPI(endpoint: string, body: any): Promise<any> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("INDOCAST_API_KEY not configured");

  const cacheKey = buildCacheKey(endpoint + "_" + JSON.stringify(body));
  const cached = await getCached(cacheKey);
  if (cached?.isFresh) {
    console.log(`[Filmbox API] Search cache HIT`);
    return cached.data;
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

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
    await setCached(cacheKey, endpoint, data, CACHE_TTL.search);
    return data;
  } catch (error) {
    console.error(`[Filmbox API] Search error:`, error);
    if (cached) return cached.data;
    throw error;
  }
}

export const filmbox = {
  getTrending: (page = 0, perPage = 18) =>
    fetchFilmboxAPI(`/trending?page=${page}&perPage=${perPage}`),

  search: (keyword: string, page = 0, perPage = 10, subjectType = "movie") =>
    postFilmboxAPI(`/search`, { keyword, page, perPage, subjectType }),

  getDetail: (detailPath: string, id: string) =>
    fetchFilmboxAPI(`/details?detailPath=${encodeURIComponent(detailPath)}&id=${encodeURIComponent(id)}`),

  getPlay: (subjectId: string, detailPath: string, se = 0, ep = 0, lang = "in_id") =>
    fetchFilmboxAPI(`/getplay?subjectId=${encodeURIComponent(subjectId)}&detailPath=${encodeURIComponent(detailPath)}&se=${se}&ep=${ep}&lang=${lang}`),
};
