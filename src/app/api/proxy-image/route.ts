import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // Fetch image from upstream server
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://komiku.org/",
      },
      // Cloudflare Workers specific: allow cf cache
      cf: { cacheTtl: 86400, cacheEverything: true } as any,
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Proxy Image] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
