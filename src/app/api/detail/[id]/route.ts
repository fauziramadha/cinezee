import { NextRequest, NextResponse } from "next/server";
import { getDetail } from "@/lib/tmdb";

export const revalidate = 3600;

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

    const data = await getDetail(id, type);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
