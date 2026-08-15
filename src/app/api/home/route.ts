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

// Helper: cek apakah hero items sudah lengkap (punya overview)
function isHeroComplete(hero: any[]): boolean {
  if (!hero || hero.length === 0) return false;
  return hero.every(
    (h) => h.overview && h.overview.trim().length > 0
  );
}

export async function GET() {
  try {
    const db = await getDB();
    const cacheKey = "home:all_data";

    // 1. Check D1 cache - TAPI skip kalau hero belum lengkap
    if (db) {
      try {
        const row = await db
          .prepare(
            "SELECT cache_value FROM api_cache WHERE cache_key = ? AND expires_at > ?"
          )
          .bind(cacheKey, Date.now())
          .first();

        if (row?.cache_value) {
          const cached = JSON.parse(row.cache_value as string);
          // VALIDATION: hanya pakai cache kalau hero items sudah punya overview
          if (isHeroComplete(cached.hero)) {
            return NextResponse.json(cached, {
              headers: { "Cache-Control": "public, max-age=60" },
            });
          } else {
            console.log("[Home API] Cache SKIP - hero incomplete, fetching fresh...");
          }
        }
      } catch (e) {
        console.warn("[Home API] D1 read error:", e);
      }
    }

    // 2. Fetch from VPS API
    console.log("[Home API] Cache MISS, fetching from VPS API...");
    const r = await fetch(`${VPS_API_BASE}/api/home`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`VPS API error: ${r.status}`);
    const vpsData = await r.json();
    const data = vpsData.data || vpsData;

    // 3. Return structured sections (VPS API sudah format items)
    const result = {
      hero: data.hero || [],
      top10: data.top10 || [],
      trending: data.trending || [],
      asian: data.asian || [],
      indian: data.indian || [],
      movies: data.trending || [],
      popularMovies: data.trending || [],
      tvShows: (data.asian || []).filter((i: any) => i.type === "tv"),
      episodes: [],
    };

    // 4. Save to D1 cache - HANYA kalau hero items sudah lengkap
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
    });

    if (db && isHeroComplete(result.hero)) {
      try {
        await db
          .prepare(
            "INSERT OR REPLACE INTO api_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)"
          )
          .bind(cacheKey, JSON.stringify(result), Date.now() + CACHE_TTL * 1000)
          .run();
        console.log("[Home API] Cached with complete hero data");
      } catch (e) {}
    } else {
      console.log("[Home API] Skip cache - hero incomplete, will refetch next time");
    }

    return response;
  } catch (err: any) {
    console.error("[Home API] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
