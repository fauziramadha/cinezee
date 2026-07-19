import { NextRequest, NextResponse } from "next/server";

// Pakai Node.js default runtime (OpenNext Cloudflare)
// Jangan pakai "edge" runtime karena env vars tidak terbaca

const TMDB_BASE = "https://api.themoviedb.org/3";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    // === Baca API key dari env ===
    const TMDB_KEY =
      process.env.TMDB_API_KEY ||
      process.env.NEXT_PUBLIC_TMDB_API_KEY ||
      "";

    if (!TMDB_KEY) {
      return NextResponse.json(
        {
          error: "TMDB_API_KEY belum diset di environment",
          debug: {
            env_keys_count: Object.keys(process.env).length,
            tmdb_keys: Object.keys(process.env).filter(k => k.toUpperCase().includes("TMDB")),
          },
        },
        { status: 500 }
      );
    }

    // === AWAIT params (Next.js 15+ async API) ===
    const { path: pathSegments } = await context.params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        {
          error: "Path required",
          debug: {
            received_params: JSON.stringify(pathSegments),
            context_keys: Object.keys(context),
          },
        },
        { status: 400 }
      );
    }

    const tmdbPath = "/" + pathSegments.join("/");

    // === Copy query params ===
    const { searchParams } = new URL(request.url);
    const tmdbParams = new URLSearchParams();
    tmdbParams.set("api_key", TMDB_KEY);
    tmdbParams.set("language", searchParams.get("language") || "en-US");

    searchParams.forEach((value, key) => {
      if (key !== "language" && key !== "api_key") {
        tmdbParams.set(key, value);
      }
    });

    const tmdbUrl = `${TMDB_BASE}${tmdbPath}?${tmdbParams.toString()}`;

    // === Fetch dari TMDB ===
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
          error: `TMDB upstream error ${r.status}`,
          path: tmdbPath,
          body: text.slice(0, 500),
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
      {
        error: "TMDB proxy crashed",
        message: err?.message || String(err),
        stack: err?.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    );
  }
}
