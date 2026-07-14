/**
 * src/app/api/subtitle/indonesian/route.ts
 *
 * GET /api/subtitle/indonesian?title=...&type=movie|tv&season=1&episode=1
 *
 * Return subtitle Indonesia (.srt atau .vtt) dari SubDL.
 * Cache di D1 selama 7 hari.
 *
 * Response: text/srt atau text/vtt (bisa langsung dipakai <track>)
 */

import { NextRequest, NextResponse } from "next/server";
import { getIndonesianSubtitle, srtToVtt } from "@/lib/subdl";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const type = (url.searchParams.get("type") || "movie") as "movie" | "tv";
  const season = url.searchParams.get("season") || undefined;
  const episode = url.searchParams.get("episode") || undefined;
  const format = (url.searchParams.get("format") || "srt") as "srt" | "vtt";

  if (!title) {
    return NextResponse.json(
      { error: "Missing 'title' parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.SUBDL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SUBDL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await getIndonesianSubtitle({
      title,
      type,
      season,
      episode,
      apiKey,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Indonesian subtitle not found" },
        { status: 404 }
      );
    }

    // Convert ke VTT kalau diminta
    const responseBody = format === "vtt" ? srtToVtt(result.text) : result.text;
    const contentType = format === "vtt" ? "text/vtt; charset=utf-8" : "text/srt; charset=utf-8";

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800", // 7 hari
        "Access-Control-Allow-Origin": "*",
        "X-Subtitle-Source": "subdl",
        "X-Subtitle-Format": format,
      },
    });
  } catch (error) {
    console.error("[SUBTITLE INDONESIAN ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch subtitle", detail: String(error) },
      { status: 500 }
    );
  }
}
