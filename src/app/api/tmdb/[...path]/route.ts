import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!TMDB_KEY) {
    return NextResponse.json(
      {
        error: "TMDB_API_KEY belum diset di Cloudflare Workers secrets",
        hint: "Buka Workers > Settings > Variables and Secrets > tambahkan TMDB_API_KEY",
      },
      { status: 500 }
    );
  }

  // Reconstruct path: /api/tmdb/movie/popular → /movie/popular
  const pathSegments = params.path || [];
  const tmdbPath = "/" + pathSegments.join("/");

  // Copy query params
  const { searchParams } = new URL(request.url);
  const tmdbParams = new URLSearchParams();
  tmdbParams.set("api_key", TMDB_KEY);
  tmdbParams.set("language", searchParams.get("language") || "en-US");

  // Forward all other params
  searchParams.forEach((value, key) => {
    if (key !== "language" && key !== "api_key") {
      tmdbParams.set(key, value);
    }
  });

  const tmdbUrl = `${TMDB_BASE}${tmdbPath}?${tmdbParams.toString()}`;

  try {
    const r = await fetch(tmdbUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json(
        {
          error: `TMDB error ${r.status}`,
          url: tmdbUrl.replace(TMDB_KEY, "***REDACTED***"),
          body: text.slice(0, 300),
        },
        { status: r.status }
      );
    }

    const data = await r.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "TMDB fetch failed", message: err?.message },
      { status: 500 }
    );
  }
}
