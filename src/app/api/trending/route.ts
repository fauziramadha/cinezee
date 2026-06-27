import { NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb";
import { withCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export const revalidate = 1800; // 30 menit (Next.js layer)

export async function GET() {
  try {
    const data = await withCache(
      CACHE_KEYS.trending("week"),
      () => getTrending("week"),
      CACHE_TTL.MEDIUM // 30 menit (Workers Cache API layer)
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
