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
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  try {
    // Query SQL super cepat, ambil episode untuk IMDB ID ini
    const result = await db.prepare(
      "SELECT season, episode FROM vidapi_show_episodes WHERE imdb_id = ?"
    ).bind(imdbId).all();

    if (!result.results || result.results.length === 0) {
      return NextResponse.json({ seasons: [] });
    }

    // Kelompokkan jadi format seasons
    const seasonsMap = new Map<number, number[]>();
    for (const row of result.results as any[]) {
      const s = row.season;
      const e = row.episode;
      if (!seasonsMap.has(s)) seasonsMap.set(s, []);
      seasonsMap.get(s)!.push(e);
    }

    const seasons = Array.from(seasonsMap.entries()).map(([season, episodes]) => ({
      season,
      episodes: episodes.sort((a, b) => a - b),
    }));

    return NextResponse.json({ seasons });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
