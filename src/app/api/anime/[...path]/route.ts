import { NextRequest, NextResponse } from "next/server";
import { fetchAnimeAPI } from "@/lib/anime-api";
import { fetchSamehadakuAPI } from "@/lib/samehadaku-api";

// ============================================================
// GET /api/anime/[...path]
// Proxy route untuk API Sanka Vollerei (Otakudesu + Samehadaku)
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

    // Append query params
    const queryString = searchParams.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }

    // Deteksi source: kalau path[0] === "samehadaku", pakai Samehadaku API
    const isSamehadaku = path[0] === "samehadaku";
    const data = isSamehadaku
      ? await fetchSamehadakuAPI(endpoint)
      : await fetchAnimeAPI(endpoint);

    const response = NextResponse.json(data);
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
