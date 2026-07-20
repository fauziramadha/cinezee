import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch {
    return null;
  }
}

function getCacheTtl(path: string): number {
  if (path.includes("/trending/") || path.includes("/popular") || 
      path.includes("/now_playing") || path.includes("/top_rated")) {
    return 21600; // 6 jam untuk list
  }
  if (path.match(/\/(movie|tv|person)\/\d+/) || path.includes("/season/") || path.includes("/episode/")) {
    return 2592000; // 30 hari untuk detail
  }
  return 3600; // 1 jam default
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    if (!TMDB_KEY) {
      return NextResponse.json({ error: "TMDB_API_KEY belum diset" }, { status: 500 });
    }

    const { path: pathSegments } = await context.params;
    if (!pathSegments?.length) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const tmdbPath = "/" + pathSegments.join("/");
    const cacheKey = `tmdb:${tmdbPath}`;

    // === 1. CEK D1 CACHE ===
    const db = await getDB();
    if (db) {
      try {
        const row = await db.prepare(
          "SELECT cache_value FROM api_cache WHERE cache_key = ? AND expires_at > ?"
        ).bind(cacheKey, Date.now()).first();
        
        if (row?.cache_value) {
          console.log(`[TMDB Cache] HIT: ${tmdbPath}`);
          return NextResponse.json(JSON.parse(row.cache_value as string), {
            headers: { "Cache-Control": "public, max-age=300" }
          });
        }
      } catch (e) {
        console.warn("[TMDB Cache] Read error:", e);
      }
    }

    // === 2. FETCH DARI TMDB ===
    const { searchParams } = new URL(request.url);
    const tmdbParams = new URLSearchParams();
    tmdbParams.set("api_key", TMDB_KEY);
    tmdbParams.set("language", searchParams.get("language") || "en-US");
    searchParams.forEach((v, k) => {
      if (k !== "language" && k !== "api_key") tmdbParams.set(k, v);
    });

    const r = await fetch(`${TMDB_BASE}${tmdbPath}?${tmdbParams.toString()}`, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });

    if (!r.ok) {
      return NextResponse.json({ error: `TMDB ${r.status}` }, { status: r.status });
    }

    const data = await r.json();

    // === 3. SIMPAN KE D1 CACHE ===
    if (db && data) {
      const ttl = getCacheTtl(tmdbPath);
      try {
        await db.prepare(
          "INSERT OR REPLACE INTO api_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)"
        ).bind(cacheKey, JSON.stringify(data), Date.now() + ttl * 1000).run();
        console.log(`[TMDB Cache] Stored: ${tmdbPath} (TTL: ${ttl}s)`);
      } catch (e) {
        console.warn("[TMDB Cache] Write error:", e);
      }
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=300" }
    });

  } catch (err: any) {
    return NextResponse.json({ error: "TMDB fetch failed", message: err?.message }, { status: 500 });
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
