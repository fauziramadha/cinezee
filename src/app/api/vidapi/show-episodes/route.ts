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
    // Cek apakah show ini ada di database VidAPI
    const row = await db.prepare(
      "SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = ?"
    ).bind(imdbId).first();

    if (row?.seasons_json) {
      const seasons = JSON.parse(row.seasons_json as string);
      return NextResponse.json({ seasons });
    }

    // Kalau tidak ada, return kosong (berarti show ini belum ada episodenya di VidAPI)
    return NextResponse.json({ seasons: [] });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err?.message }, { status: 500 });
  }
}
