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
    // 1. Cek D1 Cache (per IMDB ID, sudah di-parse)
    const row = await db.prepare(
      "SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = ?"
    ).bind(imdbId).first();

    if (row?.seasons_json) {
      console.log(`[Show Eps] D1 HIT: ${imdbId}`);
      return NextResponse.json({ seasons: JSON.parse(row.seasons_json as string) });
    }

    // 2. MISS: Baca raw text dari KV
    const kv = env?.VIDAPI_KV;
    if (!kv) {
      console.warn("[Show Eps] KV not connected");
      return NextResponse.json({ seasons: [] });
    }

    const text = await kv.get("eps_list_raw");
    if (!text) {
      console.warn("[Show Eps] eps_list_raw not found in KV");
      return NextResponse.json({ seasons: [] });
    }

    console.log(`[Show Eps] Parsing KV raw text for ${imdbId}...`);

    // 3. Parse dengan indexOf (Native C++, super cepat)
    const seasonsMap = new Map<number, number[]>();
    const searchStr = imdbId + "_";
    let idx = text.indexOf(searchStr);

    while (idx !== -1) {
      let end = text.indexOf("\n", idx);
      if (end === -1) end = text.length;

      // Parse season dan episode tanpa split (hemat CPU)
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

    console.log(`[Show Eps] Parsed ${result.length} seasons for ${imdbId}`);

    // 4. Simpan ke D1 agar request berikutnya instant
    if (result.length > 0) {
      try {
        await db.prepare(
          "INSERT OR REPLACE INTO vidapi_show_episodes (imdb_id, seasons_json, updated_at) VALUES (?, ?, ?)"
        ).bind(imdbId, JSON.stringify(result), Date.now()).run();
        console.log(`[Show Eps] Cached ${imdbId} to D1`);
      } catch (e) {
        console.warn(`[Show Eps] D1 write error:`, e);
      }
    }

    return NextResponse.json({ seasons: result });

  } catch (err: any) {
    console.error("[Show Eps] Error:", err);
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
