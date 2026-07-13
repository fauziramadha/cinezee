import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new NextResponse("Missing url", { status: 400 });
    }

    // Siapkan headers
    const headers: Record<string, string> = {
      "User-Agent": "CineStream v1.0",
    };

    // Kalau URL dari SubSource, tambahkan API key
    if (url.includes("subsource.net")) {
      const apiKey = (process.env.SUBSOURCE_API_KEY || "").trim();
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }
    }

    // Kalau URL dari SubDL, tambahkan Bearer token
    if (url.includes("subdl.com")) {
      const apiKey = (process.env.SUBDL_API_KEY || "").trim();
      if (apiKey) {
        headers["Authorization"] = "Bearer " + apiKey;
      }
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      return new NextResponse("Failed to fetch subtitle", { status: 500 });
    }

    const text = await res.text();

    // Convert SRT → VTT
    let vttText = "WEBVTT\n\n";
    vttText += text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

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
