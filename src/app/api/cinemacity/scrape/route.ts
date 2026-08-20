import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-admin-api-key");
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const movies = await request.json();
    if (!Array.isArray(movies)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Hapus data lama (cache expired)
    await d1.prepare("DELETE FROM cinemacity_home_cache").run();

    // Insert data baru
    const stmt = d1.prepare(
      `INSERT INTO cinemacity_home_cache (movie_id, slug, title, type, poster, year, stream_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const m of movies) {
      await stmt.bind(
        m.id, m.slug, m.title, m.type, m.poster, m.year, m.stream_url
      ).run();
    }

    return NextResponse.json({ success: true, count: movies.length });
  } catch (error) {
    console.error("[SCRAPE API ERROR]", error);
    return NextResponse.json({ error: "Failed to save scrape data" }, { status: 500 });
  }
}
