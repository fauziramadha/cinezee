import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CACHE_TTL = 30 * 60; // 30 menit

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  // Pakai Cloudflare Edge Cache
  const cache = (caches as any).default;
  const cacheKey = new Request(`https://internal/vidapi-eps-${imdbId}`);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // Fetch daftar episode lengkap dari VidAPI (7MB, tapi di-cache 30 menit)
    const r = await fetch(`https://vidapi.ru/ids/eps_list_imdb.txt`, {
      headers: { "User-Agent": UA },
    });

    if (!r.ok) {
      return NextResponse.json({ error: "Failed to fetch VidAPI eps list" }, { status: 502 });
    }

    const text = await r.text();
    const lines = text.split("\n");
    
    const seasonsMap = new Map<number, number[]>();

    // Cari baris yang cocok dengan imdbId
    for (const line of lines) {
      if (line.startsWith(imdbId + "_")) {
        // Format: tt123456_1x1
        const parts = line.replace(imdbId + "_", "").trim().split("x");
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
      }
    }

    // Susun hasilnya
    const result = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a - b),
    }));

    const response = NextResponse.json({ seasons: result });
    response.headers.set("Cache-Control", `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=60`);
    
    try {
      await cache.put(cacheKey, response.clone());
    } catch (e) {}

    return response;

  } catch (err: any) {
    return NextResponse.json({ error: "Failed to parse episodes" }, { status: 500 });
  }
}
