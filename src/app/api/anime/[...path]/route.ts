import { NextRequest, NextResponse } from "next/server";
import { fetchAnimeAPI } from "@/lib/anime-api";

// ============================================================
// GET /api/anime/[...path]
// Proxy route untuk API Sanka Vollerei dengan cache otomatis
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Build endpoint dari path segments
    let endpoint = "/anime/" + path.join("/");

    // Append query params (page, q, dll)
    const queryString = searchParams.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }

    // Fetch dengan cache
    const data = await fetchAnimeAPI(endpoint);

    // Return response dengan header anti-cache untuk dynamic data,
    // tapi long cache untuk static data
    const response = NextResponse.json(data);

    // Cache-Control: client bisa cache 5 menit untuk mengurangi request
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );

    return response;
  } catch (error) {
    console.error("[Anime Proxy] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("status 429")
      ? 429
      : message.includes("status 404")
      ? 404
      : 500;

    return NextResponse.json(
      {
        status: "error",
        statusCode: status,
        message:
          status === 429
            ? "Rate limit exceeded. Please try again later."
            : message,
        ok: false,
        data: null,
      },
      { status }
    );
  }
}
