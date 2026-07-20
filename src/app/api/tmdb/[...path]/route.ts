import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!TMDB_KEY) {
      return NextResponse.json(
        { error: "TMDB_API_KEY belum diset" },
        { status: 500 }
      );
    }

    const { path: pathSegments } = await context.params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const tmdbPath = "/" + pathSegments.join("/");
    const { searchParams } = new URL(request.url);
    const tmdbParams = new URLSearchParams();
    tmdbParams.set("api_key", TMDB_KEY);
    tmdbParams.set("language", searchParams.get("language") || "en-US");
    searchParams.forEach((value, key) => {
      if (key !== "language" && key !== "api_key") {
        tmdbParams.set(key, value);
      }
    });

    const tmdbUrl = `${TMDB_BASE}${tmdbPath}?${tmdbParams.toString()}`;

    const r = await fetch(tmdbUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `TMDB error ${r.status}`, body: text.slice(0, 300) },
        { status: r.status }
      );
    }

    const data = await r.json();

    // === Cache TTL berdasarkan tipe endpoint ===
    // - List endpoints (trending/popular/now_playing): 6 jam (data jarang berubah)
    // - Detail endpoints (movie/{id}/tv/{id}): 7 hari (data statis)
    // - Season/episode: 7 hari (statis)
    // - Search: 1 jam (relatif dinamis)
    let cacheTtl = 3600; // default 1 jam
    const path = tmdbPath.toLowerCase();
    if (path.includes("/trending/") || path.includes("/popular") || 
        path.includes("/now_playing") || path.includes("/upcoming") ||
        path.includes("/top_rated") || path.includes("/airing_today") ||
        path.includes("/on_the_air") || path.includes("/genre/")) {
      cacheTtl = 21600; // 6 jam untuk list
    } else if (path.match(/\/(movie|tv|person)\/\d+/) || path.includes("/season/") || path.includes("/episode/")) {
      cacheTtl = 604800; // 7 hari untuk detail
    } else if (path.includes("/search/")) {
      cacheTtl = 3600; // 1 jam untuk search
    } else if (path.includes("/discover/")) {
      cacheTtl = 21600; // 6 jam untuk discover
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Cache-Control untuk browser
        "Cache-Control": `public, max-age=300, s-maxage=${cacheTtl}, stale-while-revalidate=86400`,
        // CDN-Cache-Control untuk Cloudflare Workers
        "CDN-Cache-Control": `public, max-age=${cacheTtl}`,
        // Cloudflare cache tag (opsional)
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "TMDB fetch failed", message: err?.message },
      { status: 500 }
    );
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
