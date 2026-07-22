import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    if (!["movie", "tv"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const db = await getDB();
    const key = type === "movie" ? "movie_ids" : "tv_ids";

    // 1. Coba baca dari D1
    if (db) {
      try {
        const row = await db.prepare(
          "SELECT value FROM vidapi_sync_data WHERE key = ?"
        ).bind(key).first();

        if (row?.value) {
          const ids = JSON.parse(row.value as string);
          return NextResponse.json({ ids, count: ids.length });
        }
      } catch (e) {
        console.warn(`[D1] Read lock/error for ${type}, fallback to Edge Cache...`);
      }
    }

    // 2. FALLBACK: Baca dari Cloudflare Edge Cache (jika D1 sedang sibuk)
    const cache = (caches as any).default;
    const cacheKey = new Request(`https://internal/vidapi-ids-fallback-${type}`);
    const cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      console.log(`[Fallback] Using Edge Cache for ${type}`);
      return cachedResponse;
    }

    // 3. FALLBACK TERAKHIR: Download dari VidAPI (jika D1 & Cache kosong)
    const filename = type === "movie" ? "movie_list_imdb.txt" : "tv_list_imdb.txt";
    const r = await fetch(`https://vidapi.ru/ids/${filename}`, {
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return NextResponse.json({ ids: [], count: 0 });
    
    const text = await r.text();
    const ids = text.split("\n").map(s => s.trim()).filter(Boolean);
    
    const response = NextResponse.json({ ids, count: ids.length });
    response.headers.set("Cache-Control", `public, s-maxage=1800`); // Cache 30 menit
    try { await cache.put(cacheKey, response.clone()); } catch (e) {}
    
    return response;

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
