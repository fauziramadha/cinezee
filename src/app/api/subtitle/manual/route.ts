/**
 * src/app/api/subtitle/manual/route.ts
 *
 * GET /api/subtitle/manual?title=...&type=movie&season=1&episode=1&format=vtt
 *
 * Return manual subtitle (SRT or VTT).
 */

import { NextRequest, NextResponse } from "next/server";
import { getManualSubtitle, srtToVtt } from "@/lib/manual-subtitle";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const type = url.searchParams.get("type") || "movie";
  const season = url.searchParams.get("season") || undefined;
  const episode = url.searchParams.get("episode") || undefined;
  const format = url.searchParams.get("format") || "srt";

  if (!title) {
    return NextResponse.json({ error: "Missing 'title'" }, { status: 400 });
  }

  try {
    const subtitle = await getManualSubtitle({ title, type, season, episode });
    if (!subtitle) {
      return NextResponse.json(
        { error: "Subtitle not found" },
        { status: 404 }
      );
    }

    const body = format === "vtt" ? srtToVtt(subtitle.subtitle_text) : subtitle.subtitle_text;
    const contentType = format === "vtt" ? "text/vtt; charset=utf-8" : "text/srt; charset=utf-8";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Subtitle-Source": "manual",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
