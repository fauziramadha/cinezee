import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

async function getKV() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.VIDAPI_KV || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");
  if (!imdbId || !imdbId.startsWith("tt")) return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });

  const db = await getDB();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  try {
    // 1. Cek D1 Cache (Lazy Cache per Show)
    const row = await db.prepare("SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = ?").bind(imdbId).first();
    if (row?.seasons_json) {
      return NextResponse.json({ seasons: JSON.parse(row.seasons_json as string) });
    }

    // 2. MISS: Baca 7MB dari KV & Parse
    const kv = await getKV();
    if (!kv) return NextResponse.json({ seasons: [] });

    const text = await kv.get("eps_list_raw");
    if (!text) return NextResponse.json({ seasons: [] });

    const seasonsMap = new Map<number, number[]>();
    const searchStr = imdbId + "_";
    let idx = text.indexOf(searchStr);

    while (idx !== -1) {
      let end = text.indexOf("\n", idx);
      if (end === -1) end = text.length;
      
      // Parse pakai charCodeAt (Native C++) untuk hemat CPU time
      let i = idx + searchStr.length;
      let season = 0;
      while (i < end && text[i] !== 'x') {
        season = season * 10 + (text.charCodeAt(i) - 48);
        i++;
      }
      i++; // skip 'x'
      let episode = 0;
      while (i < end && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
        episode = episode * 10 + (text.charCodeAt(i) - 48);
        i++;
      }
      
      if (!seasonsMap.has(season)) seasonsMap.set(season, []);
      seasonsMap.get(season)!.push(episode);
      
      idx = text.indexOf(searchStr, end);
    }

    const result = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a - b),
    }));

    // 3. Simpan ke D1 agar request berikutnya instant
    if (result.length > 0) {
      await db.prepare("INSERT OR REPLACE INTO vidapi_show_episodes (imdb_id, seasons_json, updated_at) VALUES (?, ?, ?)")
        .bind(imdbId, JSON.stringify(result), Date.now()).run();
    }

    return NextResponse.json({ seasons: result });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
