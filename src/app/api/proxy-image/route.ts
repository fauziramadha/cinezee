import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Retry logic: coba 3 kali
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://komiku.org/",
        },
        cf: { cacheTtl: 86400, cacheEverything: true } as any,
      });

      if (!res.ok) {
        if (attempt < 3) continue; // Coba lagi
        return new NextResponse("Failed to fetch image", { status: res.status });
      }

      const contentType = res.headers.get("content-type") || "image/jpeg";
      
      // Pastikan ini benar-benar gambar
      if (!contentType.startsWith("image/")) {
        if (attempt < 3) continue;
        return new NextResponse("Not an image", { status: 415 });
      }

      const arrayBuffer = await res.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error) {
      if (attempt < 3) {
        // Tunggu 500ms sebelum retry
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      console.error(`[Proxy Image] Error after 3 attempts: ${url}`);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  }

  return new NextResponse("Failed after retries", { status: 500 });
}
