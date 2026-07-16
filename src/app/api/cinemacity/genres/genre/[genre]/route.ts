/**
 * src/app/api/cinemacity/genre/[genre]/route.ts
 *
 * GET /api/cinemacity/genre/[genre]
 *   ?page=1   (optional, default 1)
 *
 * List film berdasarkan genre dari cinemacity.cc.
 * Skip featured section (dle-fast_item) supaya cuma return film genre asli.
 */

import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";
import { parseMovieList } from "@/lib/cinemacity-parser";

const CINEMACITY_BASE = "https://cinemacity.cc";
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function hashKey(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cookiesToHeader(cookies: any[]): string {
  return cookies.map((c: any) => `${c.name}=${c.value}`).join("; ");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ genre: string }> }
) {
  const { genre } = await params;
  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "1";

  // Validate genre (alphanumeric + hyphen only)
  if (!/^[a-z0-9-]+$/i.test(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  let endpoint = `/genre/${genre.toLowerCase()}/`;
  if (page !== "1") endpoint += `page/${page}/`;

  // Check cache (30 min)
  const cacheKey = await hashKey(`cinemacity:genre:${genre}:${page}`);
  const cached = await dbCinemacity.getCache(cacheKey);
  if (cached) {
    try {
      return NextResponse.json({ ...JSON.parse(cached.body), _cache: "HIT" });
    } catch {}
  }

  const cookieAccount = await dbCinemacity.getActiveCookies();
  if (!cookieAccount) {
    return NextResponse.json(
      { error: "No active cinemacity cookie account" },
      { status: 503 }
    );
  }

  let cinemacityResponse: Response;
  try {
    cinemacityResponse = await fetch(`${CINEMACITY_BASE}${endpoint}`, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": cookiesToHeader(cookieAccount.cookies),
        "Referer": CINEMACITY_BASE + "/",
      },
      redirect: "follow",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", detail: String(error) },
      { status: 502 }
    );
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  if (!cinemacityResponse.ok) {
    return NextResponse.json(
      { error: `cinemacity return ${cinemacityResponse.status}` },
      { status: 502 }
    );
  }

  const html = await cinemacityResponse.text();

  // === SKIP featured section (dle-fast_item) ===
  // Genre pages menampilkan 3 film "popular now" di atas yang BUKAN genre-specific
  const genreStart = html.indexOf("dar-short_item");
  const genreHtml = genreStart !== -1 ? html.slice(genreStart) : html;

  const movies = parseMovieList(genreHtml, CINEMACITY_BASE);

  const responseData = {
    genre,
    page,
    movies,
    count: movies.length,
    source: "cinemacity.cc",
  };

  // Cache 30 min
  try {
    await dbCinemacity.setCache({
      cache_key: cacheKey,
      endpoint: `/cinemacity:genre:${genre}:${page}`,
      method: "GET",
      status_code: 200,
      body: JSON.stringify(responseData),
      content_type: "application/json",
      ttl_seconds: 1800,
    });
  } catch {}

  return NextResponse.json({ ...responseData, _cache: "MISS" });
}
