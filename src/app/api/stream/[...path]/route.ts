import { NextRequest, NextResponse } from "next/server";

const VPS_API_BASE = "https://api.cinestream.biz.id";

/**
 * OPTIMIZED stream proxy - minimal Worker CPU, fast streaming
 *
 * Key insight: Cloudflare automatically caches responses with Cache-Control
 * header. We don't need Cache API (body.tee() adds latency for 2MB segments).
 *
 * Strategy:
 * - Segments: set Cache-Control: max-age=86400 → Cloudflare edge caches
 *   automatically, NO body.tee() needed → faster streaming
 * - Playlists: set Cache-Control: max-age=60 → short cache
 * - Stream body directly from VPS to client (no buffering)
 *
 * Before: 5-8s per segment (body.tee + cache.put overhead)
 * After: 0.5-2s per segment (direct stream + HTTP cache)
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
    const range = request.headers.get("range");
    if (range) {
      headers.set("Range", range);
    }

    const res = await fetch(targetUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      // Let Cloudflare cache this response automatically via Cache-Control
      cf: {
        cacheTtl: cacheTtl,
        cacheEverything: isSegment,
      },
    });

    const contentType =
      res.headers.get("content-type") || "video/mp2t";

    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      "X-Cache": res.headers.get("cf-cache-status") || "DYNAMIC",
    });

    // Forward X-Source from VPS
    const xSource = res.headers.get("X-Source");
    if (xSource) {
      responseHeaders.set("X-Source", xSource);
    }

    // Forward critical headers
    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }
    const contentRange = res.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
      responseHeaders.set("Accept-Ranges", "bytes");
    }
    const acceptRanges = res.headers.get("accept-ranges");
    if (acceptRanges) {
      responseHeaders.set("Accept-Ranges", acceptRanges);
    }
    const etag = res.headers.get("etag");
    if (etag) {
      responseHeaders.set("ETag", etag);
    }

    // Stream body directly - NO body.tee(), NO manual cache.put()
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
