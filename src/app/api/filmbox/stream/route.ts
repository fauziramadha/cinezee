import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const allowedDomains = [
      "bcdnxw.hakunaymatata.com",
      "cacdn.hakunaymatata.com",
      "pbcdnw.aoneroom.com",
      "indocast.site",
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    if (!allowedDomains.some((d) => parsedUrl.hostname === d)) {
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version=17.0 Mobile/15E148 Safari/604.1",
      "Referer": "https://play.filmboxplus.stream/",
    };

    const range = req.headers.get("range");
    if (range) {
      headers["Range"] = range;
    }

    const response = await fetch(parsedUrl.toString(), { headers });

    if (!response.ok) {
      return new NextResponse("Failed to fetch stream", {
        status: response.status,
      });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");

    const contentType = response.headers.get("content-type") || "";
    
    // === KONVERSI SRT KE VTT UNTUK SUBTITLE ===
    // Browser hanya support WebVTT, Filmbox pakai SRT
    if (contentType.includes("subrip") || parsedUrl.pathname.includes(".srt")) {
      const srtText = await response.text();
      
      // Convert SRT to VTT
      let vttText = "WEBVTT\n\n";
      
      // Replace comma with dot in timestamps (SRT: 00:00:01,000 → VTT: 00:00:01.000)
      vttText += srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
      
      responseHeaders.set("Content-Type", "text/vtt; charset=utf-8");
      responseHeaders.set("Cache-Control", "no-cache");
      
      return new NextResponse(vttText, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // === FORWARD VIDEO STREAM ===
    if (contentType) responseHeaders.set("Content-Type", contentType);

    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) {
      responseHeaders.set("Accept-Ranges", acceptRanges);
    } else {
      responseHeaders.set("Accept-Ranges", "bytes");
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[API filmbox/stream] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    },
  });
}
