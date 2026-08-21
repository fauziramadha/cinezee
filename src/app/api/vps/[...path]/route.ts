import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * OPTIMIZED VPS proxy - minimal Worker CPU
 *
 * Uses Cloudflare's built-in HTTP caching (cf: { cacheTtl }) instead of
 * manual Cache API (body.tee() + cache.put was adding 3-5s latency).
 */

export const dynamic = "force-dynamic";

function getCacheTtl(path: string): number {
  if (path.includes("/api/image")) return 86400;
  if (path.match(/\/api\/content\//)) return 3600;
  if (path.includes("/api/stream/play/")) return 300;
  if (path.includes("/api/stream/info/")) return 300;
  if (path.includes("/api/home")) return 300;
  if (path.includes("/api/search")) return 60;
  return 300;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/vps/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/${path}${search}`;

  const cacheTtl = getCacheTtl(path);

  try {
    const headers = new Headers();
    headers.set("User-Agent", "CineStream-Worker/1.0");
    headers.set("Accept", "application/json, image/*, */*");

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      cf: {
        cacheTtl: cacheTtl,
        cacheEverything: true,
      },
    });

    const contentType = res.headers.get("content-type") || "application/json";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheTtl}`,
      "Access-Control-Allow-Origin": "*",
      "X-Cache": res.headers.get("cf-cache-status") || "DYNAMIC",
    });

    // Forward subtitle headers
    const xSubtitleSource = res.headers.get("X-Subtitle-Source");
    if (xSubtitleSource) responseHeaders.set("X-Subtitle-Source", xSubtitleSource);
    const xSubtitleWatermarked = res.headers.get("X-Subtitle-Watermarked");
    if (xSubtitleWatermarked) responseHeaders.set("X-Subtitle-Watermarked", xSubtitleWatermarked);
    const xSubtitleOffset = res.headers.get("X-Subtitle-Offset");
    if (xSubtitleOffset) responseHeaders.set("X-Subtitle-Offset", xSubtitleOffset);

    // Stream directly - no buffering
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error.name !== "TimeoutError" && error.name !== "AbortError") {
      console.error("[VPS Proxy] Error:", error.message);
    }
    return new NextResponse(null, {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/vps/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/${path}${search}`;

  try {
    const body = await request.text();

    const headers = new Headers({
      "Content-Type": request.headers.get("content-type") || "application/json",
      "User-Agent": "CineStream-Worker/1.0",
      "Accept": "application/json",
    });

    const adminKey = request.headers.get("X-Admin-API-Key");
    if (adminKey) {
      headers.set("X-Admin-API-Key", adminKey);
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.text();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[VPS Proxy] POST Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch from VPS API" },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-API-Key",
    },
  });
}
