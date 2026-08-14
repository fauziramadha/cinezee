import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";
const CACHE_TTL = 5 * 60; // 5 minutes

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch {
    return null;
  }
}

// Format cinemacity item to frontend format
function formatItem(item: any) {
  const type = item.type === "tv" ? "tv" : "movie";
  const VPS_API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";
  const posterUrl = item.poster_url 
    ? `${VPS_API_BASE}/api/image?url=${encodeURIComponent(item.poster_url)}`
    : "/placeholder-poster.png";
  
  return {
    id: item.cinemacity_id,
    cinemacityId: item.cinemacity_id,
    slug: item.slug,
    title: item.title,
    type,
    poster: posterUrl,
    backdrop: posterUrl,
    overview: item.description || "",
    year: item.release_year ? String(item.release_year) : "",
    rating: item.rating || 0,
    quality: item.quality || undefined,
  };
}

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
        console.warn("[Home API] D1 read error:", e);
      }
    }

    // 2. Fetch from VPS API (NO TMDB)
    console.log("[Home API] Cache MISS, fetching from VPS API...");
    const r = await fetch(`${VPS_API_BASE}/api/home`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`VPS API error: ${r.status}`);
    const vpsData = await r.json();
    const data = vpsData.data || vpsData;

    // 3. Format items (NO TMDB enrichment)
    const hero = (data.hero_carousel || []).map(formatItem);
    const allItems = data.sections?.[0]?.items || [];

    const movies = allItems
      .filter((i: any) => i.type === "movie")
      .map(formatItem);
    const tvShows = allItems
      .filter((i: any) => i.type === "tv")
      .map(formatItem);

    const result = {
      hero,
      movies,
      popularMovies: movies,
      tvShows,
      episodes: tvShows,
    };

    // 4. Save to D1 cache
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

    return response;
  } catch (err: any) {
    console.error("[Home API] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
