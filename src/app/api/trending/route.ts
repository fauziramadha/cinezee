import { NextResponse } from "next/server";
import { getTrending } from "@/lib/tmdb";

export const revalidate = 3600; // 1 hour

export async function GET() {
  try {
    const data = await getTrending("week");
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
