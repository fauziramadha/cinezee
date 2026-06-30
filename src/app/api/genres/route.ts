import { NextResponse } from "next/server";
import { TMDB_BASE } from "@/lib/tmdb";

/**
 * Genres API
 *
 * GET /api/genres          → Get all movie & TV genres
 * GET /api/genres?type=movie → Get movie genres only
 * GET /api/genres?type=tv  → Get TV genres only
 *
 * Returns:
 *   {
 *     "movie": [{ id: 28, name: "Action" }, ...],
 *     "tv": [{ id: 10759, name: "Action & Adventure" }, ...]
 *   }
 */

// FIX: Tambahkan ini agar Next.js tidak mencoba render static (karena pakai request.url)
export const dynamic = "force-dynamic";

const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

// Cache genres for 24 hours (genres rarely change)
export const revalidate = 86400;

// Fallback genres (kalau TMDB API down atau no API key)
const FALLBACK_MOVIE_GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

const FALLBACK_TV_GENRES = [
  { id: 10759, name: "Action & Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 10762, name: "Kids" },
  { id: 9648, name: "Mystery" },
  { id: 10763, name: "News" },
  { id: 10764, name: "Reality" },
  { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" },
  { id: 10767, name: "Talk" },
  { id: 10768, name: "War & Politics" },
  { id: 37, name: "Western" },
];

async function fetchGenres(type: "movie" | "tv"): Promise<{ id: number; name: string }[]> {
  if (!API_KEY) {
    return type === "movie" ? FALLBACK_MOVIE_GENRES : FALLBACK_TV_GENRES;
  }

  try {
    const url = `${TMDB_BASE}/genre/${type}/list?api_key=${API_KEY}&language=en-US`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // Cache 24 hours
    });
    if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
    const data = await res.json();
    return data.genres || [];
  } catch (error) {
    console.error(`[GENRES ${type} ERROR]`, error);
    return type === "movie" ? FALLBACK_MOVIE_GENRES : FALLBACK_TV_GENRES;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "movie" | "tv" | null

    // If specific type requested, return only that
    if (type === "movie") {
      const genres = await fetchGenres("movie");
      return NextResponse.json({ success: true, genres }, {
        headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
      });
    }

    if (type === "tv") {
      const genres = await fetchGenres("tv");
      return NextResponse.json({ success: true, genres }, {
        headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
      });
    }

    // Default: return both movie & TV genres
    const [movieGenres, tvGenres] = await Promise.all([
      fetchGenres("movie"),
      fetchGenres("tv"),
    ]);

    return NextResponse.json(
      {
        success: true,
        movie: movieGenres,
        tv: tvGenres,
      },
      {
        headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" },
      },
    );
  } catch (error: any) {
    console.error("[GENRES GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch genres", movie: FALLBACK_MOVIE_GENRES, tv: FALLBACK_TV_GENRES },
      { status: 200 }, // Return 200 with fallback data
    );
  }
}
