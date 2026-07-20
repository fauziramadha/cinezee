import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 hari

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    if (!["movie", "tv", "eps"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const cacheKey = `vidapi_ids:${type}`;
    const db = await getDB();

    // === 1. CEK D1 CACHE ===
    if (db) {
      try {
        const row = await db.prepare(
          "SELECT cache_value FROM api_cache WHERE cache_key = ? AND expires_at > ?"
        ).bind(cacheKey, Date.now()).first();
        
        if (row?.cache_value) {
          console.log(`[VidAPI Cache] HIT: ${type} IDs`);
          const ids = JSON.parse(row.cache_value as string);
          return NextResponse.json({ ids, cached: true, count: ids.length });
        }
      } catch (e) {
        console.warn("[VidAPI Cache] Read error:", e);
      }
    }

    // === 2. DOWNLOAD DARI VIDAPI ===
    const filename = type === "movie" ? "movie_list_imdb.txt" 
                   : type === "tv" ? "tv_list_imdb.txt" 
                   : "eps_list_imdb.txt";
    
    const r = await fetch(`https://vidapi.ru/ids/${filename}`, {
      headers: { "User-Agent": UA },
    });

    if (!r.ok) {
      return NextResponse.json({ error: `VidAPI ${r.status}` }, { status: 502 });
    }

    const text = await r.text();
    const ids = text.split("\n").map(s => s.trim()).filter(Boolean);
    console.log(`[VidAPI] Downloaded ${ids.length} ${type} IDs`);

    // === 3. SIMPAN KE D1 CACHE ===
    if (db && ids.length > 0) {
      try {
        await db.prepare(
          "INSERT OR REPLACE INTO api_cache (cache_key, cache_value, expires_at) VALUES (?, ?, ?)"
        ).bind(cacheKey, JSON.stringify(ids), Date.now() + CACHE_TTL).run();
        console.log(`[VidAPI Cache] Stored ${ids.length} ${type} IDs`);
      } catch (e) {
        console.warn("[VidAPI Cache] Write error:", e);
      }
    }

    return NextResponse.json({ ids, cached: false, count: ids.length });

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
