/**
 * src/lib/cache.ts
 *
 * Helper untuk caching API responses di Cloudflare edge.
 * Pakai Cache API (built-in di Workers) — gratis & cepat.
 *
 * Cara pakai:
 *   import { cacheGet, cacheSet, withCache } from "@/lib/cache";
 *
 *   // Atau pakai wrapper:
 *   const data = await withCache("genres:movie", async () => {
 *     return await fetchFromTMDB("/genre/movie/list");
 *   }, 3600); // cache 1 jam
 */

// ============================================================
// Cache API (Cloudflare Workers edge cache)
// ============================================================

/**
 * Ambil data dari cache berdasarkan key.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    // Cache API hanya jalan di Workers runtime
    if (typeof caches !== "undefined") {
      const cache = await caches.open("cinestream-api");
      const response = await cache.match(`https://cache.local/${key}`);
      if (response) {
        return (await response.json()) as T;
      }
    }
    return null;
  } catch (error) {
    console.error("[CACHE GET ERROR]", error);
    return null;
  }
}

/**
 * Simpan data ke cache dengan TTL (time-to-live).
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const cache = await caches.open("cinestream-api");
      const response = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${ttlSeconds}`,
          "X-Cache-Key": key,
          "X-Cache-TTL": String(ttlSeconds),
          "X-Cache-Created": Date.now().toString(),
        },
      });
      await cache.put(`https://cache.local/${key}`, response);
    }
  } catch (error) {
    console.error("[CACHE SET ERROR]", error);
  }
}

/**
 * Hapus data dari cache berdasarkan key.
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const cache = await caches.open("cinestream-api");
      await cache.delete(`https://cache.local/${key}`);
    }
  } catch (error) {
    console.error("[CACHE DELETE ERROR]", error);
  }
}

/**
 * Wrapper: Coba cache dulu, kalau tidak ada fetch dari source.
 *
 * @param key Cache key (unique per data)
 * @param fetcher Function untuk fetch data dari source
 * @param ttlSeconds Cache durasi (default 1 jam)
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // 1. Coba ambil dari cache
  const cached = await cacheGet<T>(key);
  if (cached) {
    return cached;
  }

  // 2. Fetch dari source
  const data = await fetcher();

  // 3. Simpan ke cache (fire and forget, jangan block)
  cacheSet(key, data, ttlSeconds);

  return data;
}

// ============================================================
// Cache Keys (standardisasi)
// ============================================================
export const CACHE_KEYS = {
  genres: (type: string) => `genres:${type}`,
  trending: (window: string) => `trending:${window}`,
  popularMovies: (page: number) => `popular:movie:${page}`,
  popularTV: (page: number) => `popular:tv:${page}`,
  detail: (type: string, id: string) => `detail:${type}:${id}`,
  season: (tvId: string, season: number) => `season:${tvId}:${season}`,
  search: (query: string, page: number) => `search:${query}:${page}`,
  providers: (id: string, type: string) => `providers:${id}:${type}`,
};

// ============================================================
// TTL Presets (durasi cache)
// ============================================================
export const CACHE_TTL = {
  SHORT: 5 * 60,          // 5 menit
  MEDIUM: 30 * 60,        // 30 menit
  HOUR: 60 * 60,          // 1 jam
  DAY: 24 * 60 * 60,      // 1 hari
  WEEK: 7 * 24 * 60 * 60, // 1 minggu
};
