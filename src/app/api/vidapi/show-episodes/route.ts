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
    // 1. Cek D1 Cache
    const row = await db.prepare("SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = ?").bind(imdbId).first();
    if (row?.seasons_json) {
      const cached = JSON.parse(row.seasons_json as string);
      // Jika cache adalah "fallback", return fallback mode
      if (cached === "fallback") {
        return NextResponse.json({ seasons: null, fallback: true });
      }
      return NextResponse.json({ seasons: cached });
    }

    // 2. Baca raw text dari KV
    const kv = env?.VIDAPI_KV;
    if (!kv) return NextResponse.json({ seasons: [] });

    const text = await kv.get("eps_list_raw");
    if (!text) return NextResponse.json({ seasons: [] });

    // 3. Parse dengan indexOf
    const seasonsMap = new Map<number, number[]>();
    const searchStr = imdbId + "_";
    let idx = text.indexOf(searchStr);

    while (idx !== -1) {
      let end = text.indexOf("\n", idx);
      if (end === -1) end = text.length;

      let i = idx + searchStr.length;
      let season = 0;
      while (i < end && text[i] !== 'x') {
        season = season * 10 + (text.charCodeAt(i) - 48);
        i++;
      }
      i++;
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

    // 4. FALLBACK: Kalau episode list kosong, cek TV list
    if (result.length === 0) {
      const tvRow = await db.prepare("SELECT value FROM vidapi_sync_data WHERE key = 'tv_ids_raw'").first();
      if (tvRow?.value) {
        const tvText = tvRow.value as string;
        if (tvText.includes("\n" + imdbId + "\n")) {
          // Show ada di TV list tapi episode list belum update
          // Cache sebagai "fallback" agar request berikutnya cepat
          try {
            await db.prepare("INSERT OR REPLACE INTO vidapi_show_episodes (imdb_id, seasons_json, updated_at) VALUES (?, ?, ?)")
              .bind(imdbId, JSON.stringify("fallback"), Date.now()).run();
          } catch (e) {}
          return NextResponse.json({ seasons: null, fallback: true });
        }
      }
    }

    // 5. Simpan ke D1
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
