import { NextRequest, NextResponse } from "next/server";
import { getProviderUrls } from "@/lib/providers";

/**
 * GET /api/providers?id=299534&type=movie
 * GET /api/providers?id=1399&type=tv&season=1&episode=1
 *
 * Returns sorted list of streaming provider URLs for fallback playback.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") as "movie" | "tv" | null;
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");
  const imdbId = searchParams.get("imdbId") || undefined;

  if (!id || !type) {
    return NextResponse.json(
      { error: "Missing required params: id, type" },
      { status: 400 },
    );
  }

  if (type !== "movie" && type !== "tv") {
    return NextResponse.json(
      { error: "type must be 'movie' or 'tv'" },
      { status: 400 },
    );
  }

  const movieId = parseInt(id, 10);
  if (Number.isNaN(movieId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const seasonNum = season ? parseInt(season, 10) : 1;
  const episodeNum = episode ? parseInt(episode, 10) : 1;

  const providers = getProviderUrls(movieId, type, seasonNum, episodeNum, imdbId);

  return NextResponse.json(
    {
      providers,
      primary: providers[0],
      total: providers.length,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
