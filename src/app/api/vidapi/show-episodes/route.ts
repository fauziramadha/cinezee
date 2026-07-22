import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdb");

  if (!imdbId || !imdbId.startsWith("tt")) {
    return NextResponse.json({ error: "Invalid IMDB ID" }, { status: 400 });
  }

  const db = await getDB();
  if (!db) {
    return NextResponse.json({ error: "DB not connected" }, { status: 500 });
  }

  try {
    // Ambil raw text dari D1
    const row = await db.prepare(
      "SELECT value FROM vidapi_sync_data WHERE key = ?"
    ).bind("eps_list_raw").first();

    if (row?.value) {
      const text = row.value as string;
      const seasonsMap = new Map<number, number[]>();
      
      // Pakai indexOf (Native C++) agar super cepat dan tidak kena CPU limit
      const searchStr = imdbId + "_";
      let idx = text.indexOf(searchStr);

      while (idx !== -1) {
        let end = text.indexOf("\n", idx);
        if (end === -1) end = text.length;
        
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
        idx = text.indexOf(searchStr, idx + 1);
      }

      const result = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
        season,
        episodes: episodes.sort((a, b) => a - b),
      }));

      return NextResponse.json({ seasons: result });
    }

    return NextResponse.json({ seasons: [] });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
