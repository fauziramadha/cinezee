import { NextRequest, NextResponse } from "next/server";
import { getPopularMovies } from "@/lib/tmdb";
import { withCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export const revalidate = 3600; // 1 jam (Next.js layer)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const data = await withCache(
      CACHE_KEYS.popularMovies(page),
      () => getPopularMovies(page),
      CACHE_TTL.HOUR // 1 jam (Workers Cache API layer)
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
