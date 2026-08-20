import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  try {
    const ctx = await getCloudflareContext();
    const db = (ctx.env as any)?.DB;
    if (!db) return NextResponse.json({ error: "No DB" });

    // 1. Cek total data episode di D1
    const count = await db.prepare("SELECT COUNT(*) as count FROM vidapi_show_episodes").first();
    
    // 2. Coba ambil data Breaking Bad (tt0903747)
    const breakingBad = await db.prepare("SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = 'tt0903747'").first();

    // 3. Coba ambil data Game of Thrones (tt0944947)
    const got = await db.prepare("SELECT seasons_json FROM vidapi_show_episodes WHERE imdb_id = 'tt0944947'").first();

    return NextResponse.json({
      total_shows_in_db: count?.count || 0,
      breaking_bad_exists: !!breakingBad?.seasons_json,
      breaking_bad_data: breakingBad?.seasons_json ? JSON.parse(breakingBad.seasons_json) : null,
      got_exists: !!got?.seasons_json,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
