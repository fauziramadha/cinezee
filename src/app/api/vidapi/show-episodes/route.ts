import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getEnv() {
  try {
    const ctx = await getCloudflareContext();
    return ctx.env as any;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  const env = await getEnv();
  const db = env?.DB;
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  try {
    // 1. Cek D1 Cache (Lazy Cache per Show)
    const row = await db.prepare("SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = ?").bind(imdbId).first();
    if (row?.seasons_json) {
      return NextResponse.json({ seasons: JSON.parse(row.seasons_json as string) });
    }

    // 2. MISS: Baca 7MB dari KV
    const kv = env?.VIDAPI_KV;
    if (!kv) return NextResponse.json({ seasons: [] });

    const text = await kv.get("eps_list_raw");
    if (!text) return NextResponse.json({ seasons: [] });

    // 3. Parse pakai Regex Native C++ (Super cepat, 0 CPU limit)
    // Contoh match: tt0944947_1x1
    const regex = new RegExp(`^${imdbId}_(\\d+)x(\\d+)`, "gm");
    const seasonsMap = new Map<number, number[]>();
    let match;

    while ((match = regex.exec(text)) !== null) {
      const season = parseInt(match[1], 10);
      const episode = parseInt(match[2], 10);
      if (!seasonsMap.has(season)) seasonsMap.set(season, []);
      seasonsMap.get(season)!.push(episode);
    }

    const result = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a - b),
    }));

    // 4. Simpan ke D1 agar request berikutnya instant
    if (result.length > 0) {
      try {
        await db.prepare("INSERT OR REPLACE INTO vidapi_show_episodes (imdb_id, seasons_json, updated_at) VALUES (?, ?, ?)")
          .bind(imdbId, JSON.stringify(result), Date.now()).run();
      } catch (e) {}
    }

    return NextResponse.json({ seasons: result });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
