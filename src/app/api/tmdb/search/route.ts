import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_IMG = "https://image.tmdb.org/t/p";

async function getDB() {
  try {
    const ctx = await getCloudflareContext();
    return (ctx.env as any)?.DB || null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query || !TMDB_KEY) {
    return NextResponse.json({ results: [] });
  }

  try {
    // 1. Search TMDB
    const tmdbRes = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
    if (!tmdbRes.ok) return NextResponse.json({ results: [] });
    const tmdbData = await tmdbRes.json();

    // Filter hanya movie & tv yang punya poster
    const tmdbResults = (tmdbData.results || []).filter((m: any) => 
      (m.media_type === "movie" || m.media_type === "tv") && m.poster_path
    );

    if (tmdbResults.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 2. Ambil VidAPI IDs dari D1
    const db = await getDB();
    if (!db) {
      // Kalau DB gak ada, return tanpa filter
      return NextResponse.json({ results: tmdbResults.slice(0, 10) });
    }

    const [movieRow, tvRow] = await Promise.all([
      db.prepare("SELECT value FROM vidapi_sync_data WHERE key = 'movie_ids_raw'").first(),
      db.prepare("SELECT value FROM vidapi_sync_data WHERE key = 'tv_ids_raw'").first(),
    ]);

    const movieIdsText = (movieRow?.value as string) || "";
    const tvIdsText = (tvRow?.value as string) || "";

    // 3. Filter: hanya tampilkan yang ada di VidAPI
    const filteredResults = tmdbResults.filter((m: any) => {
      const text = m.media_type === "movie" ? movieIdsText : tvIdsText;
      return text.includes("\n" + m.id + "\n");
    }).slice(0, 10);

    return NextResponse.json({ results: filteredResults });

  } catch (err) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
