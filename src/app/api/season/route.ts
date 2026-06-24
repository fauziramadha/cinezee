import { NextRequest, NextResponse } from "next/server";
import { TMDB_BASE } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const season = searchParams.get("season");

    if (!id || !season) {
      return NextResponse.json(
        { success: false, error: "Missing id or season" },
        { status: 400 },
      );
    }

    const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

    if (!API_KEY) {
      return NextResponse.json(
        { success: false, error: "TMDB API key not configured" },
        { status: 500 },
      );
    }

    const res = await fetch(
      `${TMDB_BASE}/tv/${id}/season/${season}?api_key=${API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } },
    );

    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status}`);
    }

    const data = await res.json();

    const episodes = (data.episodes || []).map((ep: any) => ({
      episodeNumber: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      stillPath: ep.still_path,
      airDate: ep.air_date,
      runtime: ep.runtime,
    }));

    return NextResponse.json({
      success: true,
      episodes,
      seasonName: data.name,
    });
  } catch (error: any) {
    console.error("[SEASON GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch episodes" },
      { status: 500 },
    );
  }
}
