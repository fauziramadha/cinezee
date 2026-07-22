import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getKV() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.VIDAPI_KV || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  const kv = await getKV();
  if (!kv) {
    return NextResponse.json({ error: "KV not connected" }, { status: 500 });
  }

  try {
    // 1. Cek Edge Cache dulu (per IMDB ID, 7 hari)
    const cache = (caches as any).default;
    const cacheKey = new Request(`https://internal/vidapi-eps-${imdbId}`);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      console.log(`[VidAPI Eps] EDGE CACHE HIT: ${imdbId}`);
      return cachedResponse;
    }

    // 2. Baca raw text 7MB dari KV (global, cepat)
    console.log(`[VidAPI Eps] KV read for ${imdbId}...`);
    const text = await kv.get("eps_list_raw");
    
    if (!text) {
      return NextResponse.json({ seasons: [] });
    }

    // 3. Parse dengan indexOf (Native C++, super cepat)
    const seasonsMap = new Map<number, number[]>();
    const searchStr = imdbId + "_";
    let idx = text.indexOf(searchStr);

    while (idx !== -1) {
      let end = text.indexOf("\n", idx);
      if (end === -1) end = text.length;
      
      const line = text.substring(idx, end);
      const parts = line.replace(searchStr, "").trim().split("x");
      
      if (parts.length === 2) {
        const season = parseInt(parts[0], 10);
        const episode = parseInt(parts[1], 10);
        if (!isNaN(season) && !isNaN(episode)) {
          if (!seasonsMap.has(season)) {
            seasonsMap.set(season, []);
          }
          seasonsMap.get(season)!.push(episode);
        }
      }
      idx = text.indexOf(searchStr, idx + 1);
    }

    const result = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a - b),
    }));

    // 4. Simpan ke Edge Cache (7 hari, per IMDB ID)
    const response = NextResponse.json({ seasons: result });
    response.headers.set("Cache-Control", `public, s-maxage=604800, stale-while-revalidate=60`);
    
    try {
      await cache.put(cacheKey, response.clone());
      console.log(`[VidAPI Eps] Cached ${imdbId}: ${result.length} seasons`);
    } catch (e) {}

    return response;

  } catch (err: any) {
    console.error("[VidAPI Eps] Error:", err);
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
