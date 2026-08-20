import { NextRequest, NextResponse } from "next/server";
import { getManualSubtitle, srtToVtt, applySubtitleOffset } from "@/lib/manual-subtitle";
import { addWatermarkToVtt } from "@/lib/subtitle-watermark";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const type = url.searchParams.get("type") || "movie";
  const season = url.searchParams.get("season") || undefined;
  const episode = url.searchParams.get("episode") || undefined;
  const server = url.searchParams.get("server") || undefined;
  const format = url.searchParams.get("format") || "vtt";

  if (!title) {
    return NextResponse.json({ error: "Missing \'title\'" }, { status: 400 });
  }

  try {
    const subtitle = await getManualSubtitle({ title, type, season, episode, server });
    if (!subtitle) {
      return NextResponse.json({ error: "Subtitle not found" }, { status: 404 });
    }

    // Apply offset
    let text = subtitle.subtitle_text;
    if (subtitle.offset_ms && subtitle.offset_ms !== 0) {
      text = applySubtitleOffset(text, subtitle.offset_ms);
    }

    // Convert ke VTT
    let vttText = srtToVtt(text);

    // FIX: Tambah watermark anti-pencurian
    vttText = addWatermarkToVtt(vttText);

    const body = format === "srt" ? text : vttText;
    const contentType = format === "srt" ? "text/srt; charset=utf-8" : "text/vtt; charset=utf-8";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Subtitle-Source": "manual",
        "X-Subtitle-Offset": String(subtitle.offset_ms || 0),
        "X-Subtitle-Watermarked": "1",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
