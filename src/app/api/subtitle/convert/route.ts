import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Convert SRT → VTT (proxy + convert)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new NextResponse("Missing url", { status: 400 });
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "CineStream v1.0" },
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch subtitle", { status: 500 });
    }

    const srtText = await res.text();

    // Convert SRT → VTT
    let vttText = "WEBVTT\n\n";
    vttText += srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

    return new NextResponse(vttText, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: any) {
    return new NextResponse("Error: " + error.message, { status: 500 });
  }
}
