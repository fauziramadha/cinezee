import { NextRequest, NextResponse } from "next/server";
import { TMDB_BASE } from "@/lib/tmdb";
import { withCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

export const revalidate = 86400; // 1 hari

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const data = await withCache(
      CACHE_KEYS.detail("person", idStr),
      async () => {
        if (!API_KEY) throw new Error("TMDB API key not configured");
        
        const url = `${TMDB_BASE}/person/${id}?api_key=${API_KEY}&language=en-US&append_to_response=combined_credits,images`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          next: { revalidate: 86400 },
        });
        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
        return res.json();
      },
      CACHE_TTL.WEEK
    );

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[PERSON GET ERROR]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
