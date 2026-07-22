import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 hari

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  // Pakai Cloudflare Edge Cache per IMDB ID
  const cache = (caches as any).default;
  const cacheKey = new Request(`https://internal/vidapi-eps-${imdbId}`);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    console.log(`[VidAPI Eps] EDGE HIT: ${imdbId}`);
    return cachedResponse;
  }

  try {
    console.log(`[VidAPI Eps] Fetching 7MB list for ${imdbId}...`);
    const r = await fetch(`https://vidapi.ru/ids/eps_list_imdb.txt`, {
      headers: { "User-Agent": UA },
    });

    if (!r.ok) {
      return NextResponse.json({ error: "Failed to fetch VidAPI eps list" }, { status: 502 });
    }

    const text = await r.text();
    const seasonsMap = new Map<number, number[]>();
    
    // PENTING: Pakai indexOf (Native C++) agar cepat dan tidak kena CPU limit 10ms
    const searchStr = imdbId + "_";
    let idx = text.indexOf(searchStr);

    while (idx !== -1) {
      // Cari akhir baris (newline)
      let end = text.indexOf("\n", idx);
      if (end === -1) end = text.length;
      
      // Ambil baris lengkap, misal: tt123456_1x1
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
      
      // Lanjut cari kejadian selanjutnya
      idx = text.indexOf(searchStr, idx + 1);
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
      console.log(`[VidAPI Eps] Cached ${imdbId} with ${result.length} seasons`);
    } catch (e) {}

    return response;

  } catch (err: any) {
    console.error("[VidAPI Eps] Error:", err);
    return NextResponse.json({ error: "Failed to parse episodes" }, { status: 500 });
  }
}
