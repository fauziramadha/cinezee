import { NextResponse } from "next/server";

const VPS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://api.cinestream.my.id";

// Edge cache TTL — Cloudflare CDN akan cache response ini selama 5 menit
// Worker CPU hanya dipakai saat cache miss (1 dari ~100 request)
const EDGE_CACHE_TTL = 300; // 5 menit

// VPS already has its own caching layer (Redis + Postgres api_cache)
// Tambah cache-bust supaya VPS returns fresh data saat Worker cache miss
export async function GET() {
  try {
    const bust = Date.now();
    console.log(`[Home API] Fetching VPS API with cache-bust: ${bust}`);
    const r = await fetch(`${VPS_API_BASE}/api/home?_t=${bust}`, {
      headers: { 
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`VPS API error: ${r.status}`);
    const vpsData = await r.json();
    const data = vpsData.data || vpsData;

    // Return structured sections
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

    console.log(`[Home API] Hero count: ${result.hero.length}`);

    // Edge cache 5 menit — Worker CPU turun 95%+
    return NextResponse.json(result, {
      headers: { 
        "Cache-Control": `public, max-age=${EDGE_CACHE_TTL}, s-maxage=${EDGE_CACHE_TTL}`,
      },
    });
  } catch (err: any) {
    console.error("[Home API] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
