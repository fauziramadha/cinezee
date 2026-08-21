import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * SIMPLE stream proxy - NO Cache API (was causing Worker hangs)
 *
 * Previous approach used caches.default + res.clone() + cache.put()
 * This caused Worker to buffer entire 2MB response → 25s hang → 502 errors
 *
 * New approach: PURE streaming
 * - Stream body directly from VPS to client
 * - Set Cache-Control header → Cloudflare CDN caches automatically
 * - NO res.clone(), NO cache.put(), NO body buffering
 * - Worker CPU minimal = no hangs, no 502s
 */

export const dynamic = "force-dynamic";

const PLAYLIST_CACHE_TTL = 60;
const SEGMENT_CACHE_TTL = 86400;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/stream/", "");
  const search = request.nextUrl.search;
  const targetUrl = `${VPS_API_BASE}/api/stream/${path}${search}`;

  const hasSegmentParam = request.nextUrl.searchParams.has("p");
  const hasShortSegPath = path.startsWith("seg/");
  const isSegment = hasSegmentParam || hasShortSegPath;
  const cacheTtl = isSegment ? SEGMENT_CACHE_TTL : PLAYLIST_CACHE_TTL;

  try {
    const headers = new Headers();
    headers.set("User-Agent", "CineStream-Worker/1.0");
    headers.set("Accept", "*/*");
    // DO NOT forward Range - causes 206 (uncacheable)

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    const contentType =
      res.headers.get("content-type") || "video/mp2t";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheTtl}`,
    });

    const xSource = res.headers.get("X-Source");
    if (xSource) {
      responseHeaders.set("X-Source", xSource);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // PURE STREAMING - no clone, no cache.put, no buffering
    // Cloudflare CDN caches based on Cache-Control header automatically
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error.name !== "TimeoutError" && error.name !== "AbortError") {
      console.error("[Stream Proxy] Error:", error.message);
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}
