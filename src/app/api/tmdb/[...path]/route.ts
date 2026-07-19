import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const TMDB_BASE = "https://api.themoviedb.org/3";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ============================================================
// Helper: baca TMDB API key dari Cloudflare env (support multiple methods)
// ============================================================
async function getTmdbKey(): Promise<string> {
  // Method 1: process.env (works untuk vars di wrangler.toml)
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY;
  if (process.env.NEXT_PUBLIC_TMDB_API_KEY) return process.env.NEXT_PUBLIC_TMDB_API_KEY;

  // Method 2: Cloudflare context (works untuk secrets)
  try {
    const mod = await import("@opennextjs/cloudflare");
    const getContext = (mod as any).getCloudflareContext || (mod as any).getRequestContext;
    if (getContext) {
      const ctx = await getContext();
      const env = ctx?.env || ctx;
      if (env?.TMDB_API_KEY) return env.TMDB_API_KEY;
      if (env?.NEXT_PUBLIC_TMDB_API_KEY) return env.NEXT_PUBLIC_TMDB_API_KEY;
    }
  } catch (e) {
    console.warn("[TMDB Proxy] getCloudflareContext not available:", e);
  }

  return "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const TMDB_KEY = await getTmdbKey();

  if (!TMDB_KEY) {
    console.error("[TMDB Proxy] TMDB_API_KEY tidak ditemukan di env");
    return NextResponse.json(
      {
        error: "TMDB_API_KEY belum diset atau tidak terbaca di runtime",
        hint: "Pastikan TMDB_API_KEY diset sebagai Secret di Cloudflare Workers, lalu re-deploy",
        debug: {
          hasProcessEnv: typeof process !== "undefined",
          processEnvKeys: typeof process !== "undefined" ? Object.keys(process.env).filter(k => k.includes("TMDB")).slice(0, 5) : [],
        },
      },
      { status: 500 }
    );
  }

  // Reconstruct path
  const pathSegments = params.path || [];
  if (pathSegments.length === 0) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }
  const tmdbPath = "/" + pathSegments.join("/");

  // Copy query params
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

  try {
    const r = await fetch(tmdbUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
      },
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error(`[TMDB Proxy] Upstream ${r.status} for ${tmdbPath}:`, text.slice(0, 300));
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
    console.error("[TMDB Proxy] Fetch failed:", err);
    return NextResponse.json(
      { error: "TMDB fetch failed", message: err?.message, path: tmdbPath },
      { status: 500 }
    );
  }
}
