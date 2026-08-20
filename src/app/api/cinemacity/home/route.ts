import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCloudflareContext();
    const d1 = ctx.env.DB as D1Database;

    // Ambil dari D1 cache (super cepat, no block!)
    const result = await d1.prepare("SELECT * FROM cinemacity_home_cache ORDER BY id ASC").all();

    const movies = result.results.map((m: any) => ({
      id: m.movie_id,
      slug: m.slug,
      type: m.type,
      title: m.title,
      poster: m.poster,
      year: m.year,
      streamUrl: m.stream_url,
      source: "cinemacity"
    }));

    return NextResponse.json({ movies, count: movies.length, source: "d1-cache" });
  } catch (error) {
    console.error("[HOME API ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch home" }, { status: 500 });
  }
}
