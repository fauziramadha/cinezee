import { NextRequest, NextResponse } from "next/server";
import { TMDB_BASE } from "@/lib/tmdb";

/**
 * Discover API - Browse movies/TV with filters
 *
 * GET /api/discover?type=movie&genre=28&year=2024&sort=popularity.desc&page=1
 *
 * Query params:
 *   type   - "movie" | "tv" (default: movie)
 *   genre  - Genre ID (e.g., 28 for Action)
 *   year   - Release year (e.g., 2024)
 *   sort   - Sort by: popularity.desc, vote_average.desc, release_date.desc, revenue.desc
 *   page   - Page number (default: 1)
 */

const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") === "tv" ? "tv" : "movie";
    const genre = searchParams.get("genre");
    const year = searchParams.get("year");
    const sort = searchParams.get("sort") || "popularity.desc";
    const page = parseInt(searchParams.get("page") || "1", 10);

    if (!API_KEY) {
      return NextResponse.json(
        { success: false, error: "TMDB API key not configured" },
        { status: 500 },
      );
    }

    // Build TMDB URL
    const params = new URLSearchParams({
      api_key: API_KEY,
      language: "en-US",
      sort_by: sort,
      page: String(page),
      "vote_count.gte": "50", // Minimum 50 votes to avoid low-quality entries
      include_adult: "false",
    });

    if (genre) {
      params.set("with_genres", genre);
    }

    if (year) {
      // TMDB uses different param names for movie vs tv
      if (type === "movie") {
        params.set("primary_release_year", year);
      } else {
        params.set("first_air_date_year", year);
      }
    }

    const url = `${TMDB_BASE}/discover/${type}?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache 1 hour
    });

    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json(
      {
        success: true,
        results: data.results || [],
        page: data.page || 1,
        total_pages: data.total_pages || 1,
        total_results: data.total_results || 0,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      },
    );
  } catch (error: any) {
    console.error("[DISCOVER GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch discover results" },
      { status: 500 },
    );
  }
}
