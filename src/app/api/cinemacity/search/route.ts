import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";
import { parseMovieList } from "@/lib/cinemacity-parser";

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const type = url.searchParams.get("type") || "all";

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query too short (min 2 chars)" }, { status: 400 });
  }

  const searchEndpoint = `/?do=search&subaction=search&story=${encodeURIComponent(query)}`;

  const cacheKey = await hashKey(`cinemacity:search:${query}:${type}`);
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

  let cinemacityResponse: Response;
  try {
    cinemacityResponse = await fetch(`${CINEMACITY_BASE}${searchEndpoint}`, {
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
    return NextResponse.json({ error: "Failed to fetch", detail: String(error) }, { status: 502 });
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  if (!cinemacityResponse.ok) {
    return NextResponse.json({ error: `cinemacity return ${cinemacityResponse.status}` }, { status: 502 });
  }

  const html = await cinemacityResponse.text();
  const movies = parseMovieList(html, CINEMACITY_BASE);

  const filtered = type === "all"
    ? movies
    : movies.filter((m) => m.type === (type === "tv" || type === "tv-series" ? "tv" : "movie"));

  const responseData = { query, movies: filtered, count: filtered.length, source: "cinemacity.cc" };

  try {
    await dbCinemacity.setCache({
      cache_key: cacheKey,
      endpoint: `/cinemacity:search:${query}`,
      method: "GET",
      status_code: 200,
      body: JSON.stringify(responseData),
      content_type: "application/json",
      ttl_seconds: 600,
    });
  } catch {}

  return NextResponse.json({ ...responseData, _cache: "MISS" });
}
