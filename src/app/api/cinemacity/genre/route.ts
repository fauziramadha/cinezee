/**
 * src/app/api/cinemacity/genres/route.ts
 *
 * GET /api/cinemacity/genres
 * Return list semua genre yang tersedia di cinemacity.cc
 */

import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function hashKey(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

// Map genre slug → display name
const GENRE_NAMES: Record<string, string> = {
  "action": "Action",
  "adventure": "Adventure",
  "animation": "Animation",
  "anime": "Anime",
  "asian": "Asian",
  "biography": "Biography",
  "indian": "Indian",
  "comedy": "Comedy",
  "crime": "Crime",
  "documentary": "Documentary",
  "drama": "Drama",
  "family": "Family",
  "fantasy": "Fantasy",
  "film-noir": "Film Noir",
  "game-show": "Game Show",
  "history": "History",
  "horror": "Horror",
  "music": "Music",
  "musical": "Musical",
  "mystery": "Mystery",
  "news": "News",
  "reality-tv": "Reality TV",
  "romance": "Romance",
  "sci-fi": "Sci-Fi",
  "short": "Short",
  "sport": "Sport",
  "specials": "Specials",
  "stand-up": "Stand Up",
  "talk-show": "Talk Show",
  "thriller": "Thriller",
  "war": "War",
  "western": "Western",
};

export async function GET() {
  const cacheKey = await hashKey("cinemacity:genres:list");
  const cached = await dbCinemacity.getCache(cacheKey);
  if (cached) {
    try {
      return NextResponse.json({ ...JSON.parse(cached.body), _cache: "HIT" });
    } catch {}
  }

  const cookieAccount = await dbCinemacity.getActiveCookies();
  if (!cookieAccount) {
    return NextResponse.json({ error: "No active cinemacity cookie account" }, { status: 503 });
  }

  let response: Response;
  try {
    response = await fetch(`${CINEMACITY_BASE}/`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": cookiesToHeader(cookieAccount.cookies),
        "Referer": CINEMACITY_BASE + "/",
      },
      redirect: "follow",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  const html = await response.text();

  // Extract genre links
  const genrePattern = /href="\/genre\/([a-z0-9-]+)\/"/g;
  const foundGenres = new Set<string>();
  let match;
  while ((match = genrePattern.exec(html)) !== null) {
    foundGenres.add(match[1]);
  }

  const genres = Array.from(foundGenres).map((slug) => ({
    slug,
    name: GENRE_NAMES[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    url: `${CINEMACITY_BASE}/genre/${slug}/`,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const responseData = { genres, count: genres.length };

  // Cache 24 hours (genre list rarely changes)
  try {
    await dbCinemacity.setCache({
      cache_key: cacheKey,
      endpoint: "/cinemacity:genres:list",
      method: "GET",
      status_code: 200,
      body: JSON.stringify(responseData),
      content_type: "application/json",
      ttl_seconds: 86400,
    });
  } catch {}

  return NextResponse.json({ ...responseData, _cache: "MISS" });
}
