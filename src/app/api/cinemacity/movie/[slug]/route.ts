import { NextRequest, NextResponse } from "next/server";
import { dbCinemacity } from "@/lib/db-extended";
import { parseDetailPage } from "@/lib/cinemacity-parser";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!/^\d+-/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug. Expected: {id}-{name}" }, { status: 400 });
  }

  const cacheKey = await hashKey(`cinemacity:detail:${slug}`);
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

  const headers = {
    "User-Agent": DEFAULT_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": cookiesToHeader(cookieAccount.cookies),
    "Referer": CINEMACITY_BASE + "/",
  };

  const movieUrl = `${CINEMACITY_BASE}/movies/${slug}.html`;
  const tvUrl = `${CINEMACITY_BASE}/tv-series/${slug}.html`;

  let finalResponse: Response | null = null;
  let finalUrl = "";

  try {
    const r = await fetch(movieUrl, { headers, redirect: "follow" });
    if (r.ok) { finalResponse = r; finalUrl = movieUrl; }
  } catch {}

  if (!finalResponse) {
    try {
      const r = await fetch(tvUrl, { headers, redirect: "follow" });
      if (r.ok) { finalResponse = r; finalUrl = tvUrl; }
    } catch {}
  }

  if (!finalResponse) {
    return NextResponse.json({ error: `Failed to fetch detail for slug: ${slug}` }, { status: 404 });
  }

  await dbCinemacity.touchLastUsed(cookieAccount.id);

  const html = await finalResponse.text();
  const detail = parseDetailPage(html, finalUrl);

  const responseData = { movie: detail, source: "cinemacity.cc" };

  try {
    await dbCinemacity.setCache({
      cache_key: cacheKey,
      endpoint: `/cinemacity:detail:${slug}`,
      method: "GET",
      status_code: 200,
      body: JSON.stringify(responseData),
      content_type: "application/json",
      ttl_seconds: 1800,
    });
  } catch {}

  return NextResponse.json({ ...responseData, _cache: "MISS" });
}
