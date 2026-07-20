import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CACHE_TTL = 30 * 60; // 30 menit

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    if (!["movie", "tv", "eps"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // === 1. Cek Cloudflare Edge Cache ===
    const cache = (caches as any).default;
    const cacheUrl = new URL(request.url);
    let cachedResponse = await cache.match(cacheUrl);

    if (cachedResponse) {
      console.log(`[VidAPI Cache] EDGE HIT: ${type} IDs`);
      return cachedResponse;
    }

    // === 2. Download dari VidAPI (PAKAI TMDB IDS) ===
    // PENTING: Pakai _tmdb.txt supaya bisa filter langsung dengan TMDB API
    const filename = type === "movie" ? "movie_list_tmdb.txt" 
                   : type === "tv" ? "tv_list_tmdb.txt" 
                   : "eps_list_tmdb.txt";
    
    console.log(`[VidAPI] Downloading ${filename}...`);
    const r = await fetch(`https://vidapi.ru/ids/${filename}`, {
      headers: { "User-Agent": UA },
    });

    if (!r.ok) {
      return NextResponse.json({ error: `VidAPI ${r.status}` }, { status: 502 });
    }

    const text = await r.text();
    const ids = text.split("\n").map(s => s.trim()).filter(Boolean);
    console.log(`[VidAPI] Fetched ${ids.length} ${type} IDs`);

    // === 3. Simpan ke Edge Cache (TTL 30 menit) ===
    const response = NextResponse.json({ ids, count: ids.length });
    response.headers.set("Cache-Control", `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=60`);
    
    try {
      await cache.put(cacheUrl, response.clone());
      console.log(`[VidAPI Cache] Stored ${type} IDs in edge cache (30 min)`);
    } catch (e) {
      console.warn("[VidAPI Cache] Put error:", e);
    }

    return response;

  } catch (err: any) {
    return NextResponse.json({ error: "VidAPI fetch failed", message: err?.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
