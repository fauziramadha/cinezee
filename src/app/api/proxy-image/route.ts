import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // Fetch image from upstream server with proper headers
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://komiku.org/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      console.error(`[Proxy Image] Failed: ${res.status} for ${url}`);
      return new NextResponse("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    
    // Check if response is actually an image
    if (!contentType.startsWith("image/")) {
      console.error(`[Proxy Image] Not an image: ${contentType} for ${url}`);
      return new NextResponse("Not an image", { status: 415 });
    }

    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=31536000",
      },
    });
  } catch (error) {
    console.error("[Proxy Image] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
