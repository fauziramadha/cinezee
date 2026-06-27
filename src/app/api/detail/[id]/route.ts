import { NextRequest, NextResponse } from "next/server";
import { getDetail } from "@/lib/tmdb";
import { withCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

export const revalidate = 86400; // 1 hari (Next.js layer)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "movie" | "tv";

    if (!type || (type !== "movie" && type !== "tv")) {
      return NextResponse.json(
        { error: "type query param is required (movie|tv)" },
        { status: 400 },
      );
    }

    const id = parseInt(idStr, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const data = await withCache(
      CACHE_KEYS.detail(type, idStr),
      () => getDetail(id, type),
      CACHE_TTL.DAY // 1 hari (Workers Cache API layer)
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
