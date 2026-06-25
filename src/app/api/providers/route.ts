/**
 * src/app/api/providers/route.ts (REVISED)
 *
 * GET /api/providers?id=299534&type=movie
 * GET /api/providers?id=1399&type=tv&season=1&episode=1
 * GET /api/providers?id=299534&type=movie&imdbId=tt4154796
 *
 * Returns sorted list of streaming provider URLs.
 *
 * Strategy:
 * 1. Coba load dari database (admin-managed providers)
 * 2. Kalau DB kosong/belum di-migrate → fallback ke hardcoded getProviderUrls
 * 3. Kalau ada imdbId → pakai hardcoded (karena DB schema tidak support imdbId)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProviderUrls } from "@/lib/providers";
import { getProvidersForMedia } from "@/lib/providers-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") as "movie" | "tv" | null;
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");
  const imdbId = searchParams.get("imdbId") || undefined;

  // === Validation ===
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

  // === Strategy: Try dynamic DB providers first ===
  let providers: Array<{ name: string; brutality: number; url: string }> = [];

  // Kalau tidak ada imdbId, coba load dari database (admin-managed)
  // Kalau ada imdbId, skip dynamic loading karena DB schema tidak support imdbId
  if (!imdbId) {
    try {
      const dynamicProviders = await getProvidersForMedia(
        movieId,
        type,
        seasonNum,
        episodeNum,
      );
      if (dynamicProviders.length > 0) {
        // Strip _config field (internal use only) sebelum return ke client
        providers = dynamicProviders.map((p) => ({
          name: p.name,
          brutality: p.brutality,
          url: p.url,
        }));
      }
    } catch (error) {
      console.error("[PROVIDERS DYNAMIC] Failed, falling back to hardcoded:", error);
    }
  }

  // === Fallback: Hardcoded providers dari src/lib/providers.ts ===
  if (providers.length === 0) {
    providers = getProviderUrls(movieId, type, seasonNum, episodeNum, imdbId);
  }

  // === Response ===
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
