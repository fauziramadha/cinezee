import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY =
  process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_IMG = "https://image.tmdb.org/t/p";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL = 5 * 60; // 5 minutes

// ============================================================
// Helpers
// ============================================================
async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch {
    return null;
  }
}

async function tmdbFetch(path: string): Promise<any | null> {
  if (!TMDB_KEY) return null;
  try {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set("api_key", TMDB_KEY);
    url.searchParams.set("language", "en-US");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function imgUrl(path?: string | null, size: string = "w342"): string {
  if (!path) return "/placeholder-poster.png";
  return `${TMDB_IMG}/${size}${path}`;
}

// ============================================================
// Fetch from VPS API
// ============================================================
async function fetchVPSHome(): Promise<{
  hero_carousel: any[];
  sections: Array<{ id: string; title: string; items: any[] }>;
}> {
  const r = await fetch(`${VPS_API_BASE}/api/home`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`VPS API error: ${r.status}`);
  const data = await r.json();
  return data.data || data;
}

// ============================================================
// Search TMDB by title (since cinemacity doesn't have tmdb_id)
// ============================================================
async function searchTMDBByTitle(
  title: string,
  type: "movie" | "tv",
  year?: number
): Promise<any | null> {
  if (!TMDB_KEY || !title) return null;
  try {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: title,
      language: "en-US",
      page: "1",
      include_adult: "false",
    });
    if (year) params.set("year", String(year));

    const r = await fetch(
      `${TMDB_BASE}/search/${type}?${params}`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

// ============================================================
// Enrich cinemacity item with TMDB metadata
// ============================================================
async function enrichItem(item: any): Promise<any> {
  const type: "movie" | "tv" = item.type === "tv" ? "tv" : "movie";

  const enriched: any = {
    id: item.cinemacity_id,
    cinemacityId: item.cinemacity_id,
    slug: item.slug,
    tmdbId: 0,
    imdbId: undefined,
    title: item.title || "Untitled",
    type,
    poster: item.poster_url || "/placeholder-poster.png",
    backdrop: item.poster_url || "/placeholder-poster.png",
    logo: undefined,
    overview: item.description || "",
    year: item.release_year ? String(item.release_year) : "",
    rating: item.rating || 0,
    genre: undefined,
    seasons: undefined,
  };

  // Search TMDB by title
  const tmdbResult = await searchTMDBByTitle(
    item.title,
    type,
    item.release_year || undefined
  );

  if (tmdbResult) {
    enriched.tmdbId = tmdbResult.id;
    if (tmdbResult.overview) enriched.overview = tmdbResult.overview;
    if (tmdbResult.backdrop_path)
      enriched.backdrop = imgUrl(tmdbResult.backdrop_path, "w1280");
    if (tmdbResult.poster_path)
      enriched.poster = imgUrl(tmdbResult.poster_path, "w342");
    if (tmdbResult.vote_average)
      enriched.rating = tmdbResult.vote_average;
    if (tmdbResult.release_date || tmdbResult.first_air_date) {
      const dateStr = tmdbResult.release_date || tmdbResult.first_air_date;
      enriched.year = dateStr.substring(0, 4);
    }

    // Get detail for imdb_id, seasons, logos
    const detail = await tmdbFetch(
      `/${type}/${tmdbResult.id}?append_to_response=external_ids,images&include_image_language=en,null`
    );
    if (detail) {
      if (detail.imdb_id) enriched.imdbId = detail.imdb_id;
      if (detail.genres?.length) {
        enriched.genre = detail.genres.map((g: any) => g.name).join(", ");
      }
      // Get English logo
      const logo =
        detail.images?.logos?.find((l: any) => l.iso_639_1 === "en") ||
        detail.images?.logos?.[0];
      if (logo) enriched.logo = imgUrl(logo.file_path, "w500");

      if (type === "tv" && detail.seasons) {
        enriched.seasons = detail.seasons
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            name: s.name,
          }));
      }
    }
  }

  return enriched;
}

// ============================================================
// Batch enrich with rate limiting
// ============================================================
async function enrichBatch(items: any[]): Promise<any[]> {
  const batchSize = 5;
  const results: any[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const enriched = await Promise.all(batch.map(enrichItem));
    results.push(...enriched);
  }

  return results;
}

// ============================================================
// Main Handler
// ============================================================
export async function GET() {
  try {
    const db = await getDB();
    const cacheKey = "home:all_data";

    // 1. Check D1 cache
    if (db) {
      try {
        const row = await db
          .prepare(
            "SELECT cache_value FROM api_cache WHERE cache_key = ? AND expires_at > ?"
          )
          .bind(cacheKey, Date.now())
          .first();

        if (row?.cache_value) {
          return NextResponse.json(JSON.parse(row.cache_value as string), {
            headers: { "Cache-Control": "public, max-age=60" },
          });
        }
      } catch (e) {
        console.warn("[Home API] D1 read error, trying Edge Cache...", e);
        const cache = (caches as any).default;
        const edgeCached = await cache.match(
          new Request("https://internal/home-data-cache")
        );
        if (edgeCached) return edgeCached;
      }
    }

    // 2. Fetch from VPS API
    console.log("[Home API] Cache MISS, fetching from VPS API...");
    const vpsData = await fetchVPSHome();

    // 3. Collect all items from sections + hero
    const allItems: any[] = [...(vpsData.hero_carousel || [])];
    vpsData.sections?.forEach((section) => {
      allItems.push(...(section.items || []));
    });

    // Dedupe by cinemacity_id
    const seen = new Set<string>();
    const uniqueItems = allItems.filter((item) => {
      if (!item.cinemacity_id || seen.has(item.cinemacity_id)) return false;
      seen.add(item.cinemacity_id);
      return true;
    });

    // 4. Enrich with TMDB (parallel, batched)
    const enriched = await enrichBatch(uniqueItems);

    // 5. Split by type
    const movies = enriched.filter((m) => m.type === "movie");
    const tvShows = enriched.filter((m) => m.type === "tv");

    // 6. Build response (same format as before for frontend compatibility)
    const result = {
      hero: enriched.slice(0, 10),
      movies: movies.slice(0, 15),
      popularMovies: movies.slice(0, 15),
      tvShows: tvShows.slice(0, 15),
      episodes: tvShows.slice(0, 15), // TV shows as "latest episodes"
    };

    // 7. Save to D1 cache + Edge Cache
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });

    if (db) {
      try {
        await db
          .prepare(
            "INSERT OR REPLACE INTO api_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)"
          )
          .bind(cacheKey, JSON.stringify(result), Date.now() + CACHE_TTL * 1000)
          .run();
      } catch (e) {}
    }

    try {
      const cache = (caches as any).default;
      await cache.put(
        new Request("https://internal/home-data-cache"),
        response.clone()
      );
    } catch (e) {}

    return response;
  } catch (err: any) {
    console.error("[Home API] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
