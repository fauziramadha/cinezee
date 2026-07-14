/**
 * src/app/api/subtitle/indonesian/route.ts
 *
 * GET /api/subtitle/indonesian?title=...&type=movie|tv&season=1&episode=1
 *
 * Return subtitle Indonesia (.srt atau .vtt) dari SubDL.
 * Cache di D1 selama 7 hari.
 *
 * PENTING: Cloudflare Workers gak bisa akses process.env.SUBDL_API_KEY
 * Harus pakai getCloudflareContext().env.SUBDL_API_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

  // ============================================================
  // PENTING: Akses SUBDL_API_KEY via getCloudflareContext
  // (process.env gak jalan di Cloudflare Workers runtime)
  // ============================================================
  let apiKey: string | undefined;
  try {
    const ctx = await getCloudflareContext();
    apiKey = ctx?.env?.SUBDL_API_KEY as string | undefined;
    console.log("[Subtitle Route] API key from context:", apiKey ? "found" : "NOT FOUND");
  } catch (err) {
    console.error("[Subtitle Route] getCloudflareContext error:", err);
  }

  // Fallback ke process.env (untuk local dev)
  if (!apiKey) {
    apiKey = process.env.SUBDL_API_KEY;
    console.log("[Subtitle Route] API key from process.env:", apiKey ? "found" : "NOT FOUND");
  }

  if (!apiKey) {
    console.error("[Subtitle Route] SUBDL_API_KEY not configured");
    return NextResponse.json(
      { error: "SUBDL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    console.log("[Subtitle Route] Fetching subtitle for:", title, type, season, episode);
    const result = await getIndonesianSubtitle({
      title,
      type,
      season,
      episode,
      apiKey,
    });

    if (!result) {
      console.log("[Subtitle Route] No subtitle found");
      return NextResponse.json(
        { error: "Indonesian subtitle not found" },
        { status: 404 }
      );
    }

    const responseBody = format === "vtt" ? srtToVtt(result.text) : result.text;
    const contentType = format === "vtt" ? "text/vtt; charset=utf-8" : "text/srt; charset=utf-8";

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800",
        "Access-Control-Allow-Origin": "*",
        "X-Subtitle-Source": "subdl",
        "X-Subtitle-Format": format,
      },
    });
  } catch (error) {
    console.error("[Subtitle Route] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subtitle", detail: String(error) },
      { status: 500 }
    );
  }
}
